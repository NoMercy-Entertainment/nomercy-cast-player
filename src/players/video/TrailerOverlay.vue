<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ResolvedTrailer } from '@/lib/trailers';
import type { FocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { mountLanguageScreen } from './pluginPanels/LanguageScreen';
import type { TrackItem } from './pluginPanels/LanguageScreen';
import { mountPlaybackOSD } from './pluginPanels/PlaybackOSD';
import type { PlaybackOSDHandle } from './pluginPanels/PlaybackOSD';
import { mountSeekContainer } from './pluginPanels/SeekContainer';
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
 *   pause and open the seek bar, the language key opens subtitles;
 * - controls hide after four seconds while playing;
 * - Back closes an open panel first, and only then the trailer;
 * - the trailer closes itself when it ends.
 */

const props = defineProps<{
	trailer: ResolvedTrailer;
	fallbackTitle: string;
}>();

const emit = defineEmits<{ close: [] }>();

interface TrailerPlayer {
	overlay: HTMLDivElement;
	videoElement: HTMLVideoElement;
	on: (event: string, handler: (data?: unknown) => void) => void;
	play: () => Promise<void>;
	pause: () => void;
	togglePlayback: () => void;
	seek: (seconds: number) => number;
	currentTime: () => number;
	duration: () => number;
	subtitles: () => Array<{ label: string; language: string }>;
	subtitleIndex: () => number;
	subtitle: (index?: number) => unknown;
	dispose: () => void;
}

const CONTROLS_TIMEOUT_MS = 4000;
const LANGUAGE_KEYS = new Set(['ChannelUp', 'MediaTrackNext', 'l', 'L']);
const TOGGLE_KEYS = new Set(['MediaPlayPause', 'MediaPlay', 'MediaPause']);

const rootEl = ref<HTMLElement | null>(null);
const focusSinkEl = ref<HTMLElement | null>(null);
const mountId = `nm-trailer-${Math.random().toString(36).slice(2, 10)}`;

let player: TrailerPlayer | null = null;
let osd: PlaybackOSDHandle | null = null;
let closePanel: (() => void) | null = null;
let hideTimer: number | null = null;
let closed = false;

function languageLabel(code: string): string {
	try {
		return new Intl.DisplayNames([authStore.locale.value, 'en'], { type: 'language', fallback: 'code' }).of(code) ?? code;
	}
	catch {
		// A malformed code throws rather than falling back.
		return code;
	}
}

function title(): string {
	return props.trailer.title ?? props.fallbackTitle;
}

function close(): void {
	if (closed)
		return;
	closed = true;
	emit('close');
}

function clearHideTimer(): void {
	if (hideTimer !== null) {
		window.clearTimeout(hideTimer);
		hideTimer = null;
	}
}

function showControls(): void {
	osd?.setVisible(true);
	clearHideTimer();
	hideTimer = window.setTimeout(() => {
		if (closePanel === null && player && !isPaused())
			osd?.setVisible(false);
	}, CONTROLS_TIMEOUT_MS);
}

function isPaused(): boolean {
	return player?.videoElement.paused ?? true;
}

function openPanel(unmount: () => void): void {
	closePanel?.();
	closePanel = (): void => {
		unmount();
		closePanel = null;
		// The panel took focus for its own buttons; give it back so Enter
		// and Back reach the trailer again.
		focusSinkEl.value?.focus();
	};
}

function openSeek(): void {
	if (!player)
		return;
	player.pause();
	osd?.setVisible(false);
	const target = player;
	openPanel(mountSeekContainer({
		parent: target.overlay,
		getCurrentTime: () => target.currentTime(),
		getDuration: () => target.duration(),
		onCommit: (seconds) => {
			target.seek(seconds);
			closePanel?.();
			void target.play();
		},
		onCancel: () => {
			closePanel?.();
			showControls();
		},
	}));
}

function openLanguage(): void {
	if (!player)
		return;
	const target = player;
	const subtitleTracks: TrackItem[] = target.subtitles().map((track, index) => ({
		id: index,
		label: track.label,
	}));
	const current = target.subtitleIndex();
	openPanel(mountLanguageScreen({
		parent: target.overlay,
		audioTracks: [],
		subtitleTracks,
		currentSubtitleId: current >= 0 ? current : 'off',
		onPickAudio: () => {},
		onPickSubtitle: id => target.subtitle(id === 'off' ? -1 : Number(id)),
		onExit: () => closePanel?.(),
	}));
}

// Keys the focus system does not route to a modal: arrows are swallowed by a
// modal group with a focused entry, so they are read here. Enter and Back go
// through the focus system below.
function onKey(e: KeyboardEvent): void {
	if (!player || closePanel !== null)
		return;

	screensaverStore.resetIdle();

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
		if (closePanel === null)
			close();
		return true;
	},
});

// Enter arrives as a click on the focused element. It lands on this sink, not
// on the player's container, so the player's own click-to-play handler never
// fires alongside this one.
function onSelect(): void {
	if (!player || closePanel !== null)
		return;
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
		const factory = mod.default as unknown as (id: string) => { setup: (config: unknown) => TrailerPlayer };

		player = factory(mountId).setup({
			playlist: [{
				id: props.trailer.videoId,
				file: props.trailer.url,
				title: title(),
				description: '',
				image: '',
				duration: '',
				tracks: props.trailer.subtitles.map((track, index) => ({
					id: index,
					kind: 'subtitles',
					file: track.url,
					language: track.language,
					label: languageLabel(track.language),
				})),
			}],
			autoPlay: true,
			controls: false,
			muted: false,
			preload: 'auto',
			// No accessToken. On a progressive source this player appends it
			// to the URL as ?token=, which would hand the bearer token to the
			// media host and sits on top of a query the host signs.
			displayLanguage: authStore.locale.value,
		});

		if (closed) {
			player.dispose();
			player = null;
			return;
		}

		const target = player;
		osd = mountPlaybackOSD({
			parent: target.overlay,
			title: title(),
			getCurrentTime: () => target.currentTime(),
			getDuration: () => target.duration(),
		});
		showControls();

		target.on('play', () => showControls());
		target.on('pause', () => {
			clearHideTimer();
			// Seeking pauses first; the seek bar replaces the controls rather
			// than stacking on top of them.
			if (closePanel === null)
				osd?.setVisible(true);
		});
		// Any progress keeps the ambient screensaver away while it plays.
		target.on('time', () => screensaverStore.resetIdle());
		// A single trailer, so ended is the end.
		target.on('ended', () => close());
		target.on('error', () => close());
	}
	catch (err) {
		console.error('[trailer] player init failed', err);
		close();
	}
});

onBeforeUnmount(() => {
	window.removeEventListener('keydown', onKey, true);
	unregisterFocusSink?.();
	clearHideTimer();
	closePanel?.();
	osd?.dispose();
	osd = null;
	player?.dispose();
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
