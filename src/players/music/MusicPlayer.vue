<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { musicSyncBridge } from './syncBridge';
import { authStore } from '@/stores/authStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

/**
 * Headless music engine wrapper. The
 * @nomercy-entertainment/nomercy-music-player package is event-driven
 * with no UI; we attach our sync bridge and let NowPlayingHero +
 * ProgressControls + QueuePeek render off the playbackStore the bridge
 * keeps fresh.
 *
 * Engine creation is deferred until the auth store is ready so the
 * engine has a server URL + access token resolver from the start.
 * Re-creates if the receiver swaps servers mid-session (rare; today
 * the LAUNCH customData pins one server per cast session).
 */

// These three events are about loading the engine itself, not a track, so the
// name has to say so or a reader blames the song that was queued.
const ENGINE_LABEL = 'music-player engine';

let engine: { dispose?: () => void } | null = null;
let stoppedByUnmount = false;

async function initEngine(): Promise<void> {
	if (engine || stoppedByUnmount)
		return;
	const serverUrl = authStore.serverUrl.value;
	if (!serverUrl)
		return;
	recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested, 0, 0, 0, ENGINE_LABEL);
	try {
		const mod = await import('@nomercy-entertainment/nomercy-music-player');
		const Ctor
			= (mod as { default?: new (opts: unknown) => unknown }).default
				?? (mod as { MusicPlayer?: new (opts: unknown) => unknown }).MusicPlayer;
		if (typeof Ctor !== 'function') {
			recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceFailed, 0, 0, 0, ENGINE_LABEL);
			console.warn('[music-player] no constructor exported from package');
			return;
		}
		const created = new Ctor({
			siteTitle: 'NoMercy',
			baseUrl: serverUrl,
			expose: false,
			disableAutoPlayback: false,
		}) as { dispose?: () => void; setAccessToken?: (t: string | (() => string)) => void };
		created.setAccessToken?.(() => authStore.accessToken.value ?? '');
		engine = created;
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceResolved, 0, 0, 0, ENGINE_LABEL);
		musicSyncBridge.attach(engine as never);
	}
	catch (err) {
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceFailed, 0, 0, 0, ENGINE_LABEL);
		console.error('[music-player] init failed', err);
	}
}

watch(
	() => authStore.ready.value,
	(ready) => {
		if (ready)
			void initEngine();
	},
	{ immediate: true },
);

onBeforeUnmount(() => {
	stoppedByUnmount = true;
	musicSyncBridge.detach();
	engine?.dispose?.();
	engine = null;
});
</script>

<template>
	<slot />
</template>
