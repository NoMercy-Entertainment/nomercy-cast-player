<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { musicSyncBridge } from './syncBridge';
import type { MusicEngineLike } from './syncBridge';
import { handleMusicMediaKey } from './mediaKeys';
import { authStore } from '@/stores/authStore';
import { playbackStore } from '@/stores/playbackStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import type { DiagnosticsCodeValue } from '@/lib/diagnostics/events';
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

interface EngineOptions {
	siteTitle: string;
	baseUrl: string;
	expose: boolean;
	disableAutoPlayback: boolean;
}

type Engine = MusicEngineLike & {
	dispose?: () => void;
	setAccessToken?: (token: string | (() => string)) => void;
};

type EngineCtor = new (options: EngineOptions) => Engine;

let engine: Engine | null = null;
let stoppedByUnmount = false;

async function initEngine(): Promise<void> {
	if (engine || stoppedByUnmount) return;

	const serverUrl = authStore.serverUrl.value;

	if (!serverUrl) return;

	const recordSource = (code: DiagnosticsCodeValue): void => {
		recordDiagnostic(DiagnosticsCategory.Playback, code, 0, 0, 0, ENGINE_LABEL);
	};

	recordSource(DiagnosticsCode.SourceRequested);

	try {
		const mod = await import('@nomercy-entertainment/nomercy-music-player');
		const exported: object = mod;
		const Ctor: EngineCtor | undefined = Reflect.get(exported, 'default') ?? Reflect.get(exported, 'MusicPlayer');

		if (typeof Ctor !== 'function') {
			recordSource(DiagnosticsCode.SourceFailed);
			console.warn('[music-player] no constructor exported from package');

			return;
		}

		const created = new Ctor({
			siteTitle: 'NoMercy',
			baseUrl: serverUrl,
			expose: false,
			disableAutoPlayback: false,
		});

		created.setAccessToken?.(() => authStore.accessToken.value ?? '');
		engine = created;
		recordSource(DiagnosticsCode.SourceResolved);
		musicSyncBridge.attach(created);
	} catch (err) {
		recordSource(DiagnosticsCode.SourceFailed);
		console.error('[music-player] init failed', err);
	}
}

watch(
	() => authStore.ready.value,
	(ready) => {
		if (ready) {
			void initEngine();
		}
	},
	{ immediate: true },
);

// The remote's media keys reach music on every screen, once a track is loaded.
function onMediaKey(event: KeyboardEvent): void {
	const loaded = playbackStore.music.track.value != null;

	handleMusicMediaKey(event, loaded
		? musicSyncBridge.current()
		: null, playbackStore.music.playing.value);
}

window.addEventListener('keydown', onMediaKey);

onBeforeUnmount(() => {
	window.removeEventListener('keydown', onMediaKey);
	stoppedByUnmount = true;
	musicSyncBridge.detach();
	engine?.dispose?.();
	engine = null;
});
</script>

<template>
	<slot />
</template>
