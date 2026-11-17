<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import i18next from '@/i18n/i18next';
import { videoSyncBridge } from './syncBridge';
import { TvUiPlugin } from './plugins/tv-ui';
import { attachChapterAutoSkip, detachChapterAutoSkip } from './ChapterAutoSkipPlugin';
import { prepareChapterPlaylist } from './chapterFile';
import { attachAssPlainTextFallback } from './assPlainTextFallback';
import type { NMVideoPlayer, VideoPlayerConfig } from '@nomercy-entertainment/nomercy-video-player';
import { leaveToPreviousOrHome } from '@/router/leave';
import { authStore } from '@/stores/authStore';
import { TMDB_BASE } from '@/lib/images/urls';
import { playbackStore } from '@/stores/playbackStore';
import type { PlaylistItem } from '@/queries/usePlaylistQuery';
import type { WatchType } from '@/stores/playbackStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import type { DiagnosticsCodeValue } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

const props = defineProps<{
	type: WatchType;
	id: string;
	resumeAt?: number;
	/** The route carried cast=true: a cast plays at once, with no pre-screen. */
	isCast?: boolean;
	playlist?: PlaylistItem[];
	initialItem?: PlaylistItem;
	/** The audio and subtitle the handing-off device showed, from the cast intent. */
	castAudioLanguage?: string;
	castSubtitle?: {
		language: string;
		type?: string;
		format?: string;
	};
}>();

const emit = defineEmits<{ error: [message: string] }>();

// The player reads its stored pick from `storage`, ahead of the account
// default. A cast seeds that pick with what the phone showed.
function castPickStorage(): VideoPlayerConfig['storage'] {
	if (!props.castAudioLanguage && !props.castSubtitle)
		return undefined;

	const values = new Map<string, string>();

	if (props.castAudioLanguage) {
		values.set('nmplayer-language-audio', props.castAudioLanguage);
	}

	if (props.castSubtitle) {
		values.set('nmplayer-language-subtitle', JSON.stringify({ ...props.castSubtitle, explicit: true }));
	}

	return {
		get: (key) => values.get(key) ?? null,
		set: (key, value) => { values.set(key, value); },
		remove: (key) => { values.delete(key); },
		getJSON<T>(key: string): T | null {
			const raw = values.get(key);

			return raw === undefined
				? null
				: JSON.parse(raw) as T;
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
let unmounted = false;

interface MergeItem { id: string | number; file?: string }

function mergeLivePlaylist(
	current: readonly MergeItem[],
	incoming: readonly MergeItem[],
	playingId: string | number,
): readonly MergeItem[] {
	const merged = [...current];
	const playingIndex = merged.findIndex((item) => String(item.id) === String(playingId));

	if (playingIndex < 0)
		return current;

	const knownIds = new Set(merged.map((item) => String(item.id)));

	for (let i = 1; i < incoming.length; i++) {
		const item = incoming[i]!;

		if (knownIds.has(String(item.id)) || !item.file) continue;

		const previousId = String(incoming[i - 1]!.id);
		const previousIndex = merged.findIndex((entry) => String(entry.id) === previousId);

		if (previousIndex < playingIndex) continue;

		merged.splice(previousIndex + 1, 0, item);
		knownIds.add(String(item.id));
	}

	return merged;
}

watch(() => props.playlist, (incoming) => {
	if (props.type !== 'tv' || !incoming || !engine) return;

	const current = engine.queue();
	const playingId = engine.item()?.id;

	if (playingId === undefined) return;

	const merged = mergeLivePlaylist(current, incoming, playingId);

	if (merged.length > current.length) {
		engine.queue(merged as never);
	}
});

onMounted(async () => {
	if (!containerEl.value) return;

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

	const recordSource = (code: DiagnosticsCodeValue): void => {
		recordDiagnostic(DiagnosticsCategory.Playback, code, 0, 0, 0, mediaLabel.value);
	};

	recordSource(DiagnosticsCode.SourceRequested);

	try {
		const prepared = await prepareChapterPlaylist(
			props.playlist ?? [],
			authStore.accessToken.value,
			authStore.serverUrl.value,
		);

		if (unmounted) return;

		// Tag the container element so the package's factory can target it
		// by ID — its public surface uses string IDs, not direct DOM refs.
		if (!containerEl.value.id) {
			containerEl.value.id = `nm-video-${Math.random().toString(36).slice(2, 10)}`;
		}

		const mod = await import('@nomercy-entertainment/nomercy-video-player');
		const { SubtitleOverlayPlugin } = await import('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay');

		if (unmounted) return;

		const factory = mod.default;

		if (typeof factory !== 'function') {
			recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceFailed, 0, 0, 0, 'video-player package');
			console.warn('[video-player] no factory exported from package');
			emit('error', i18next.t('player.start_error'));

			return;
		}

		const player: NMVideoPlayer = factory(containerEl.value.id);

		// The video-player package bundles the retired 4.1.0 worker; this one is copied from 0.2.x into the receiver origin.
		player.addPlugin(SubtitleOverlayPlugin);

		player.addPlugin(mod.OctopusPlugin, {
			workerUrl: '/js/octopus/nomercy-libass-worker.js',
			fallbackFont: '/js/octopus/default.ttf',
		});

		// A cast, or a handed-over position, starts playback at once, with no pre-screen.
		player.addPlugin(TvUiPlugin, {
			skipPreScreen: props.isCast === true || (typeof props.resumeAt === 'number' && props.resumeAt > 0),
			onExit: () => leaveToPreviousOrHome(router),
		});

		player.setup({
			playlist: prepared as never,
			auth: {
				bearerToken: () => authStore.accessToken.value ?? '',
				mediaOrigins: () => authStore.serverUrl.value ?? undefined,
			},
			// The server sends media paths relative to itself; posters are TMDB paths.
			baseUrl: authStore.serverUrl.value ?? undefined,
			baseImageUrl: `${TMDB_BASE}/original`,
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
		// seekToIndex takes a 1-based position, the list index is 0-based.
		const startIndex = props.playlist?.findIndex((item) => item.id === props.initialItem?.id) ?? -1;

		if (startIndex > 0) {
			player.once('queue', () =>
				player.seekToIndex(startIndex + 1));
		}

		recordSource(DiagnosticsCode.SourceResolved);

		videoSyncBridge.attach(player);

		attachChapterAutoSkip(player);

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
	} catch (err) {
		recordSource(DiagnosticsCode.SourceFailed);
		console.error('[video-player] init failed', err);
		emit('error', i18next.t('player.start_error'));
	}
});

onBeforeUnmount(() => {
	unmounted = true;
	videoSyncBridge.detach();
	detachChapterAutoSkip();
	detachAssFallback?.();
	detachAssFallback = null;
	void engine?.dispose();
	engine = null;
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

/* The TV UI plugin ships no video rule; without this a 4:3 film overflows the screen. */
.video-player-root :deep(video) {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: contain;
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
</style>
