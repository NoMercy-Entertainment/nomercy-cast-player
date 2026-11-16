<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ResolvedTrailer } from '@/lib/trailers';
import type { FocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { moveFocus, t } from './plugins/tv-ui/dom';
import type { Direction } from './plugins/tv-ui/dom';
import { keyOf } from './plugins/tv-ui/keys';
import { bottomBar, seekStrip, subtitleDialog, topBar } from './plugins/tv-ui/panels';
import type { BottomBarHandle, Choice, Panel, SeekStripHandle } from './plugins/tv-ui/panels';
import { cancelSeek, canEnterSeekMode, commitSeek, frameTimesFor, seekStripKey, snapIndex } from './plugins/tv-ui/seek';
import './plugins/tv-ui/style.css';
import { mountOverlayHost } from './overlayHost';
import type { NMVideoPlayer } from '@nomercy-entertainment/nomercy-video-player';
import { authStore } from '@/stores/authStore';
import { screensaverStore } from '@/stores/screensaverStore';

/**
 * A trailer, full screen, on the receiver. The web twin of the KMP TV app's
 * TrailerOverlayPlayerTV and TrailerTvUiPlugin, and it keeps their contract:
 *
 * - no watch-progress tracking, so this never touches the sync bridge or the
 *   playback store the watch screen reports through;
 * - no pre-screen and no episode picker, because a trailer has neither;
 * - Enter plays and pauses, up and down show the controls, left and right
 *   pause and open the seek strip, the language key opens subtitles;
 * - controls hide after four seconds while playing;
 * - Back closes an open panel first, and only then the trailer;
 * - the trailer closes itself when it ends.
 *
 * The controls are the tv-ui panels, the same ones the watch screen draws.
 */

const props = defineProps<{
	trailer: ResolvedTrailer;
	fallbackTitle: string;
}>();

const emit = defineEmits<{ close: [] }>();

const CONTROLS_TIMEOUT_MS = 4000;
const LANGUAGE_KEYS = new Set(['ChannelUp', 'MediaTrackNext', 'l', 'L']);
const TOGGLE_KEYS = new Set(['MediaPlayPause', 'MediaPlay', 'MediaPause']);
const ARROWS = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
} as const satisfies Record<string, Direction>;

interface SeekState {
	strip: SeekStripHandle;
	frames: number[];
	index: number;
}

const rootEl = ref<HTMLElement | null>(null);
const focusSinkEl = ref<HTMLElement | null>(null);
const mountId = `nm-trailer-${Math.random().toString(36).slice(2, 10)}`;

let player: NMVideoPlayer | null = null;
let host: HTMLElement | null = null;
let top: Panel | null = null;
let bottom: BottomBarHandle | null = null;
let seek: SeekState | null = null;
let dialog: Panel | null = null;
let hideTimer: number | null = null;
let closed = false;

function languageLabel(code: string): string {
	try {
		return new Intl.DisplayNames([authStore.locale.value, 'en'], { type: 'language', fallback: 'code' }).of(code) ?? code;
	} catch {
		// A malformed code throws rather than falling back.
		return code;
	}
}

function title(): string {
	return props.trailer.title ?? props.fallbackTitle;
}

function close(): void {
	if (closed) return;

	closed = true;
	emit('close');
}

function clearHideTimer(): void {
	if (hideTimer !== null) {
		window.clearTimeout(hideTimer);
		hideTimer = null;
	}
}

function isPaused(): boolean {
	return player?.videoElement?.paused ?? true;
}

function panelOpen(): boolean {
	return seek !== null || dialog !== null;
}

function updateBar(): void {
	if (!player) return;

	bottom?.update({
		playing: !isPaused(),
		time: player.time(),
		duration: player.duration(),
		buffered: 0,
		override: seek
			? seek.frames[seek.index]
			: null,
		chapters: [],
	});
}

function setControls(visible: boolean): void {
	if (!host || !top || !bottom) return;

	if (!visible) {
		top.root.remove();
		bottom.root.remove();

		return;
	}

	if (!seek) {
		host.append(top.root);
	}

	host.append(bottom.root);
	updateBar();
}

function showControls(): void {
	setControls(true);
	clearHideTimer();

	hideTimer = window.setTimeout(() => {
		if (!panelOpen() && player && !isPaused()) {
			setControls(false);
		}
	}, CONTROLS_TIMEOUT_MS);
}

function closeSeek(): void {
	seek?.strip.root.remove();
	seek = null;
	focusSinkEl.value?.focus();
}

// A commit seeks to the chosen frame; a cancel keeps the position. Both resume playback.
function leaveSeek(commit?: number): void {
	const target = player;

	closeSeek();
	setControls(false);

	if (!target) return;

	const keep = (): void => undefined;
	const play = (): void => void target.play();
	const seekTo = (time: number): void => void target.time(time);

	if (commit === undefined) {
		cancelSeek(keep, play);

		return;
	}

	commitSeek(commit, seekTo, keep, play);
}

function closeDialog(): void {
	dialog?.root.remove();
	dialog = null;
	focusSinkEl.value?.focus();
	showControls();
}

// Closes the open panel, if any, and says whether there was one.
function closePanel(): boolean {
	if (seek) {
		leaveSeek();

		return true;
	}

	if (dialog) {
		closeDialog();

		return true;
	}

	return false;
}

function openSeek(): void {
	if (!player || !host || !canEnterSeekMode(player.duration())) return;

	player.pause();
	top?.root.remove();
	const frames = frameTimesFor(undefined, player.duration());
	const index = snapIndex(frames, player.time());
	const strip = seekStrip(frames, index);

	seek = {
		strip,
		frames,
		index,
	};

	host.append(strip.root);
	setControls(true);
	strip.focus();
}

function pickSubtitle(index: number | null): void {
	void player?.subtitle(index);
	closeDialog();
}

function subtitleChoices(target: NMVideoPlayer): Choice[] {
	const current = target.subtitle()?.index ?? null;
	const off = {
		label: t('dialog_subtitle_off'),
		selected: current === null,
		onPick: () => pickSubtitle(null),
	} as const satisfies Choice;

	const tracks = target.subtitles().map((track, index) => ({
		label: track.label,
		selected: current === index,
		onPick: () => pickSubtitle(index),
	}) as const satisfies Choice);

	return [off, ...tracks];
}

function openLanguage(): void {
	if (!player || !host || dialog) return;

	clearHideTimer();
	const panel = subtitleDialog({ subtitles: subtitleChoices(player) });

	dialog = panel;
	host.append(panel.root);
	panel.focus();
}

function seekKey(event: KeyboardEvent): void {
	if (!seek) return;

	const result = seekStripKey(seek.frames, seek.index, keyOf(event));

	if (!result.consumed) return;

	event.preventDefault();
	seek.index = result.index;
	seek.strip.select(result.index);

	if (result.commit !== undefined) {
		leaveSeek(result.commit);

		return;
	}

	if (result.cancel) {
		leaveSeek();

		return;
	}

	updateBar();
}

function dialogKey(event: KeyboardEvent): void {
	if (!dialog) return;

	const direction = Object.entries(ARROWS).find(([name]) => name === event.key)?.[1];

	if (direction) {
		event.preventDefault();
		moveFocus(dialog.root, direction);

		return;
	}

	const focused = document.activeElement;

	if (keyOf(event) === 'center' && focused instanceof HTMLElement && dialog.root.contains(focused)) {
		event.preventDefault();
		focused.click();
	}
}

// Keys the focus system does not route to a modal: arrows are swallowed by a
// modal group with a focused entry, so they are read here. Enter and Back go
// through the focus system below.
function onKey(e: KeyboardEvent): void {
	if (!player || keyOf(e) === 'back') return;

	screensaverStore.resetIdle();

	if (seek) {
		seekKey(e);

		return;
	}

	if (dialog) {
		dialogKey(e);

		return;
	}

	if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
		e.preventDefault();
		openSeek();

		return;
	}

	if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
		e.preventDefault();
		showControls();

		return;
	}

	if (LANGUAGE_KEYS.has(e.key)) {
		e.preventDefault();
		openLanguage();

		return;
	}

	if (TOGGLE_KEYS.has(e.key)) {
		e.preventDefault();
		player.togglePlayback();
		showControls();
	}
}

const group = useFocusGroup({
	type: 'modal',
	containerEl: rootEl,
	autoFocus: false,
	onEscape: (dir) => {
		if (dir !== 'back')
			return true;

		// An open panel closes itself on Back; the trailer waits its turn.
		if (!closePanel()) {
			close();
		}

		return true;
	},
});

// Enter arrives as a click on the focused element. It lands on this sink, not
// on the player's container, so the player's own click-to-play handler never
// fires alongside this one.
function onSelect(): void {
	if (!player || panelOpen()) return;

	player.togglePlayback();
	showControls();
}

// Registered on this component's own group by hand. useFocusEntry injects
// its group, and inject only sees what a parent provided, so called here it
// registered into the info screen's group: the modal owned no entry, focus
// never entered it, and Back on the trailer was routed as a page back.
const focusSink: FocusEntry = {
	key: 'trailer-focus',
	order: 0,
	enabled: true,
	el: () => focusSinkEl.value,
	isFocused: () => document.activeElement === focusSinkEl.value,
	focus: () => focusSinkEl.value?.focus({ preventScroll: true }),
	blur: () => focusSinkEl.value?.blur(),
	action: onSelect,
};
let unregisterFocusSink: (() => void) | null = null;

onMounted(async () => {
	window.addEventListener('keydown', onKey, true);

	unregisterFocusSink = group.register(focusSink);
	await nextTick();
	group.focusByKey(focusSink.key);

	try {
		const mod = await import('@nomercy-entertainment/nomercy-video-player');
		const { SubtitleOverlayPlugin } = await import('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay');
		const created: NMVideoPlayer = mod.default(mountId);

		created.addPlugin(SubtitleOverlayPlugin);

		created.addPlugin(mod.OctopusPlugin, {
			workerUrl: '/js/octopus/nomercy-libass-worker.js',
			fallbackFont: '/js/octopus/default.ttf',
		});

		// No auth: on a progressive source the player appends a token to the
		// URL as ?token=, which would hand the bearer token to the media host
		// and sits on top of a query the host signs.
		created.setup({
			playlist: [{
				id: props.trailer.videoId,
				url: props.trailer.url,
				poster: '',
				title: title(),
				subtitles: props.trailer.subtitles.map((track, index) => ({
					id: String(index),
					language: track.language,
					label: languageLabel(track.language),
					url: track.url,
				})),
			}] as never,
			autoPlay: true,
			muted: false,
			preload: 'auto',
		});

		player = created;

		if (closed) {
			void created.dispose();
			player = null;

			return;
		}

		const target = created;

		host = mountOverlayHost(target.container);
		host.classList.add('tvui-root');

		top = topBar({
			item: { title: title() },
			hasNext: false,
			onSettings: openLanguage,
			onNext: () => undefined,
		});

		bottom = bottomBar(() => {
			target.togglePlayback();
			showControls();
		});

		showControls();

		target.on('play', () =>
			showControls());

		target.on('pause', () => {
			clearHideTimer();

			// Seeking pauses first; the seek strip replaces the controls rather
			// than stacking on top of them.
			if (!panelOpen()) {
				setControls(true);
			}
		});

		// Any progress keeps the ambient screensaver away while it plays.
		target.on('time', () => {
			screensaverStore.resetIdle();
			updateBar();
		});

		// A single trailer, so ended is the end.
		target.on('ended', () =>
			close());

		target.on('error', () =>
			close());
	} catch (err) {
		console.error('[trailer] player init failed', err);
		close();
	}
});

onBeforeUnmount(() => {
	window.removeEventListener('keydown', onKey, true);
	unregisterFocusSink?.();
	clearHideTimer();
	host?.remove();
	host = null;
	top = null;
	bottom = null;
	seek = null;
	dialog = null;
	void player?.dispose();
	player = null;
	screensaverStore.resetIdle();
});
</script>

<template>
	<Teleport to="body">
		<div ref="rootEl" class="trailer-overlay" role="dialog" :aria-label="title()">
			<div :id="mountId" class="trailer-surface" />
			<button
				ref="focusSinkEl"
				type="button"
				class="trailer-focus"
				data-focusable
				:aria-label="title()"
				@click="onSelect"
			/>
		</div>
	</Teleport>
</template>

<style scoped>
.trailer-overlay {
	position: fixed;
	inset: 0;
	z-index: 200;
	background: black;
}
.trailer-surface {
	position: relative;
	width: 100%;
	height: 100%;
}
.trailer-focus {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	border: 0;
	overflow: hidden;
	opacity: 0;
	outline: none;
}
</style>
