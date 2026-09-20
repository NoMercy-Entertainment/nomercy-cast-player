<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { videoSyncBridge } from './syncBridge';
import { TVOverlayPlugin } from './TVOverlayPlugin';
import { attachChapterAutoSkip, detachChapterAutoSkip } from './ChapterAutoSkipPlugin';
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
}>();

const containerEl = ref<HTMLElement | null>(null);
let engine: { dispose?: () => void } | null = null;
let overlay: TVOverlayPlugin | null = null;

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

	recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested);

	try {
		// Tag the container element so the package's factory can target it
		// by ID — its public surface uses string IDs, not direct DOM refs.
		if (!containerEl.value.id)
			containerEl.value.id = `nm-video-${Math.random().toString(36).slice(2, 10)}`;

		const mod = (await import(
			'@nomercy-entertainment/nomercy-video-player',
		)) as unknown as Record<string, unknown>;
		// Package's default export is a factory: `(id?: string) => NMPlayer`.
		// Older receiver builds may have shipped a class named NoMercyPlayer
		// instead — handle both shapes.
		const exported = (mod.default ?? mod.NoMercyPlayer) as unknown;
		if (typeof exported !== 'function') {
			recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceFailed);
			console.warn('[video-player] no factory exported from package');
			return;
		}
		const factoryOrCtor = exported as (id?: string) => unknown;
		let created: unknown;
		try {
			created = factoryOrCtor(containerEl.value.id);
		}
		catch {
			const Ctor = exported as new (opts: unknown) => unknown;
			created = new Ctor({
				container: containerEl.value,
				accessToken: () => authStore.accessToken.value ?? '',
				autoPlay: true,
				isTv: true,
				locale: authStore.locale.value ?? 'en',
			});
		}
		engine = created as { dispose?: () => void };
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceResolved);

		const playerLike = engine as unknown as Parameters<typeof videoSyncBridge.attach>[0];
		videoSyncBridge.attach(playerLike);

		attachChapterAutoSkip(playerLike as never);

		overlay = new TVOverlayPlugin(playerLike as never, {
			skipPreScreen: typeof props.resumeAt === 'number' && props.resumeAt > 0,
		});
		overlay.attach();

		if (props.playlist && props.initialItem) {
			const e = engine as { loadPlaylist?: (p: unknown, i?: unknown) => void };
			e.loadPlaylist?.(props.playlist, props.initialItem);
		}
		if (typeof props.resumeAt === 'number' && props.resumeAt > 0) {
			// Wait until the player reports it's ready and the duration is
			// resolved before seeking — seeking before the manifest loads
			// is silently ignored by the npm player. Mirrors APK
			// WatchScreen.kt's `videoPlayerStore.timeState.first { duration > 0 }`.
			const player = engine as {
				on?: (event: string, handler: () => void) => void;
				once?: (event: string, handler: () => void) => void;
				seek?: (s: number) => void;
				getDuration?: () => number;
			};
			const seekToResume = (): void => {
				const dur = player.getDuration?.() ?? 0;
				if (dur > 0) {
					player.seek?.(props.resumeAt!);
					return;
				}
				// duration not ready yet — wait one more 'time' tick
				player.once?.('time', seekToResume);
			};
			player.once?.('ready', seekToResume);
		}
	}
	catch (err) {
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceFailed);
		console.error('[video-player] init failed', err);
	}
});

onBeforeUnmount(() => {
	overlay?.detach();
	videoSyncBridge.detach();
	detachChapterAutoSkip();
	engine?.dispose?.();
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
