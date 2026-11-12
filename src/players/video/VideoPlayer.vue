<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { videoSyncBridge } from './syncBridge';
import { TVOverlayPlugin } from './TVOverlayPlugin';
import { attachChapterAutoSkip, detachChapterAutoSkip } from './ChapterAutoSkipPlugin';
import { prepareChapterPlaylist } from './chapterFile';
import { attachAssPlainTextFallback } from './assPlainTextFallback';
import type { NMVideoPlayer, VideoPlayerConfig } from '@nomercy-entertainment/nomercy-video-player';
import { authStore } from '@/stores/authStore';
import { playbackStore } from '@/stores/playbackStore';
import type { PlaylistItem } from '@/queries/usePlaylistQuery';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

const props = defineProps<{
	type: 'movie' | 'tv';
	id: string;
	resumeAt?: number;
	playlist?: PlaylistItem[];
	initialItem?: PlaylistItem;
	/** The audio and subtitle the handing-off device showed, from the cast intent. */
	castAudioLanguage?: string;
	castSubtitle?: { language: string; type?: string; format?: string };
}>();

const emit = defineEmits<{ error: [message: string] }>();

// The player reads its stored pick from `storage`, ahead of the account
// default. A cast seeds that pick with what the phone showed.
function castPickStorage(): VideoPlayerConfig['storage'] {
	if (!props.castAudioLanguage && !props.castSubtitle)
		return undefined;
	const values = new Map<string, string>();
	if (props.castAudioLanguage)
		values.set('nmplayer-language-audio', props.castAudioLanguage);
	if (props.castSubtitle)
		values.set('nmplayer-language-subtitle', JSON.stringify({ ...props.castSubtitle, explicit: true }));
	return {
		get: key => values.get(key) ?? null,
		set: (key, value) => { values.set(key, value); },
		remove: (key) => { values.delete(key); },
		getJSON<T>(key: string): T | null {
			const raw = values.get(key);
			return raw === undefined ? null : JSON.parse(raw) as T;
		},
		setJSON: (key, value) => { values.set(key, JSON.stringify(value)); },
	};
}

// The report must name the title a viewer tried to watch, not just say that
// some source failed.
const mediaLabel = computed(() => `${props.type}-${props.id}`);

const router = useRouter();
const containerEl = ref<HTMLElement | null>(null);
let engine: NMVideoPlayer | null = null;
let detachAssFallback: (() => void) | null = null;
let overlay: TVOverlayPlugin | null = null;
let unmounted = false;
let disposeChapters: (() => void) | null = null;

function mergeLivePlaylist(current: PlaylistItem[], incoming: PlaylistItem[], playingId: string | number): PlaylistItem[] {
	const merged = [...current];
	const playingIndex = merged.findIndex(item => String(item.id) === String(playingId));
	if (playingIndex < 0)
		return current;
	const knownIds = new Set(merged.map(item => String(item.id)));
	for (let i = 1; i < incoming.length; i++) {
		const item = incoming[i]!;
		if (knownIds.has(String(item.id)) || !item.file)
			continue;
		const previousId = String(incoming[i - 1]!.id);
		const previousIndex = merged.findIndex(entry => String(entry.id) === previousId);
		if (previousIndex < playingIndex)
			continue;
		merged.splice(previousIndex + 1, 0, item);
		knownIds.add(String(item.id));
	}
	return merged;
}

watch(() => props.playlist, (incoming) => {
	if (props.type !== 'tv' || !incoming || !engine)
		return;
	const current = engine.queue() as unknown as PlaylistItem[];
	const playingId = (engine.item() as unknown as PlaylistItem | undefined)?.id;
	if (playingId === undefined)
		return;
	const merged = mergeLivePlaylist(current, incoming, playingId);
	if (merged.length > current.length)
		engine.queue(merged as never);
});

onMounted(async () => {
	if (!containerEl.value)
		return;

	// Update playbackStore eagerly so the WatchScreen can render title /
	// duration even before the engine has loaded the manifest.
	if (props.initialItem) {
		playbackStore.video.applyState({
			type: props.type,
			id: props.id,
			title: props.initialItem.title,
			duration_ms: typeof props.initialItem.duration === 'number'
				? props.initialItem.duration * 1000
				: undefined,
		});
	}

	recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested, 0, 0, 0, mediaLabel.value);

	try {
		const prepared = await prepareChapterPlaylist(props.playlist ?? [], authStore.accessToken.value);
		if (unmounted) {
			prepared.dispose();
			return;
		}
		disposeChapters = prepared.dispose;
		// Tag the container element so the package's factory can target it
		// by ID — its public surface uses string IDs, not direct DOM refs.
		if (!containerEl.value.id)
			containerEl.value.id = `nm-video-${Math.random().toString(36).slice(2, 10)}`;

		const mod = await import('@nomercy-entertainment/nomercy-video-player');
		const { SubtitleOverlayPlugin } = await import('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay');
		if (unmounted)
			return;
		const factory = mod.default;
		if (typeof factory !== 'function') {
			recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceFailed, 0, 0, 0, 'video-player package');
			console.warn('[video-player] no factory exported from package');
			emit('error', 'The video player could not start.');
			return;
		}
		const player: NMVideoPlayer = factory(containerEl.value.id);
		// The video-player package bundles the retired 4.1.0 worker; this one is copied from 0.2.x into the receiver origin.
		player.addPlugin(SubtitleOverlayPlugin);
		player.addPlugin(mod.OctopusPlugin, {
			workerUrl: '/js/octopus/nomercy-libass-worker.js',
			fallbackFont: '/js/octopus/default.ttf',
		});
		player.setup({
			playlist: prepared.playlist as never,
			auth: { bearerToken: () => authStore.accessToken.value ?? '' },
			autoPlay: true,
			language: authStore.locale.value ?? 'en',
			// The account's synced pick: this player has no stored choice of its own.
			defaultSubtitleLanguage: authStore.defaultSubtitleLanguage.value ?? undefined,
			defaultAudioLanguage: authStore.defaultAudioLanguage.value ?? undefined,
			storage: castPickStorage(),
		});
		engine = player;
		detachAssFallback = attachAssPlainTextFallback(player);

		// setup() plays the first queue item. A cast names the item to watch
		// (episode 5, not episode 1): switch to it once the queue is loaded.
		const startIndex = props.playlist?.findIndex(item => item.id === props.initialItem?.id) ?? -1;
		if (startIndex > 0)
			player.once('queue', () => player.seekToIndex(startIndex));
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceResolved, 0, 0, 0, mediaLabel.value);

		videoSyncBridge.attach(player);

		attachChapterAutoSkip(player);

		overlay = new TVOverlayPlugin(player, {
			skipPreScreen: typeof props.resumeAt === 'number' && props.resumeAt > 0,
			onExit: () => router.back(),
		});
		overlay.attach();

		if (typeof props.resumeAt === 'number' && props.resumeAt > 0) {
			// Seeking before the duration is known is ignored: wait for it.
			const seekToResume = (): void => {
				if (player.duration() > 0) {
					player.time(props.resumeAt!);
					return;
				}
				player.once('time', seekToResume);
			};
			player.once('ready', seekToResume);
		}
	}
	catch (err) {
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceFailed, 0, 0, 0, mediaLabel.value);
		console.error('[video-player] init failed', err);
		emit('error', 'The video player could not start.');
	}
});

onBeforeUnmount(() => {
	unmounted = true;
	overlay?.detach();
	videoSyncBridge.detach();
	detachChapterAutoSkip();
	detachAssFallback?.();
	detachAssFallback = null;
	void engine?.dispose();
	disposeChapters?.();
	engine = null;
	overlay = null;
});
</script>

<template>
	<div ref="containerEl" class="video-player-root" />
</template>

<style scoped>
.video-player-root {
	width: 100%;
	height: 100%;
	background: black;
	position: relative;
}

:global(.tv-overlay-host) {
	position: absolute;
	inset: 0;
	z-index: 10;
}
:global(.ass-plain-text) {
	position: absolute;
	left: 10%;
	right: 10%;
	bottom: 8%;
	text-align: center;
	color: oklch(1 0 0);
	font-size: 32px;
	line-height: 1.3;
	text-shadow: 0 2px 4px oklch(0 0 0 / 0.9);
	white-space: pre-line;
	pointer-events: none;
	z-index: 5;
}
:global(.panel) {
	position: absolute;
	inset: 0;
	background: oklch(0 0 0 / 0.7);
	backdrop-filter: blur(8px);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 48px;
	gap: 32px;
	z-index: 10;
}
:global(.panel-button) {
	font: inherit;
	font-weight: 600;
	font-size: 16px;
	padding: 14px 24px;
	background: oklch(1 0 0 / 0.08);
	color: oklch(1 0 0);
	border: 0;
	border-radius: 999px;
	cursor: pointer;
	outline: none;
	transition: background 150ms ease-out;
}
:global(.panel-button:focus-visible) {
	background: oklch(0.7 0.18 35);
	color: oklch(0.18 0.02 35);
}
:global(.panel-button.current) {
	outline: 2px solid oklch(0.7 0.18 35);
}
:global(.pre-screen-title) {
	margin: 0;
	font-size: 40px;
	font-weight: 700;
}
:global(.pre-screen-buttons) {
	display: flex;
	gap: 16px;
	flex-wrap: wrap;
	justify-content: center;
}
:global(.episode-list),
:global(.language-list) {
	display: flex;
	flex-direction: column;
	gap: 8px;
	width: 720px;
	max-height: 60vh;
	overflow-y: auto;
}
:global(.lang-section h3) {
	margin: 24px 0 8px;
	font-size: 14px;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: oklch(1 0 0 / 0.7);
}
:global(.seek-container) {
	inset: auto 0 80px 0;
	background: linear-gradient(180deg, transparent, oklch(0 0 0 / 0.85));
	padding: 32px 10%;
	display: flex;
	flex-direction: column;
	gap: 12px;
}
:global(.seek-time) {
	color: oklch(1 0 0);
	font-size: 14px;
	font-variant-numeric: tabular-nums;
}
:global(.seek-bar) {
	height: 4px;
	background: oklch(1 0 0 / 0.2);
	border-radius: 999px;
	overflow: hidden;
}
:global(.seek-fill) {
	height: 100%;
	background: oklch(0.7 0.18 35);
}
</style>
