import { ref, shallowRef } from 'vue';
import { TypedHub } from '@/lib/signalr/hubs';
import { buildHub } from '@/lib/signalr/connection';
import type { HubName } from '@/lib/signalr/connection';
import type { MusicPlayerStateMsg, RefreshLibraryPayload, VideoPlayerStateMsg } from '@/lib/signalr/events';
import { createRefreshBatcher, invalidateAllLibrary, invalidateFromServer, invalidatePlugins, refreshKeyOf } from '@/lib/queryShim';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import type { DiagnosticsCodeValue } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';
import type { Thrown } from '@/lib/diagnostics/swallowed';
import { playbackStore } from './playbackStore';
import type { ConnectedDeviceSnapshot } from './playbackStore';
import { authStore } from './authStore';

/**
 * SignalR lifecycle store per spec §9.5.
 *
 * - Four hubs: video / music / device / plugin
 * - Bootstrap retry: each hub's initial start() loops every 5s until success
 *   (server may still be rebooting after a deploy)
 * - Forever-retry policy on the connection itself handles mid-session
 *   disconnects in the background — UI shows "reconnecting…" but state
 *   preserved
 * - onreconnected fires invalidateAllLibrary to catch missed RefreshLibrary
 *   events while disconnected
 * - DEGRADED is owned by authStore; SignalR-only failures never trigger it
 */

export type ConnectionState =
	| 'idle' |
	'connecting' |
	'connected' |
	'reconnecting' |
	'failed';

const connectionState = ref<ConnectionState>('idle');

const videoHub = shallowRef<TypedHub | null>(null);
const musicHub = shallowRef<TypedHub | null>(null);
const deviceHub = shallowRef<TypedHub | null>(null);
const pluginHub = shallowRef<TypedHub | null>(null);

let stopRequested = false;

// Each connectAll owns one set of hubs; an older set stops retrying.
let hubGeneration = 0;

// The video hub holds per-connection state, so what a device plays is told to it again on every connect.
const videoHubConnectedListeners = new Set<() => void>();

function announceVideoHubConnected(): void {
	for (const listener of Array.from(videoHubConnectedListeners)) {
		listener();
	}
}

function onVideoHubConnected(listener: () => void): () => void {
	videoHubConnectedListeners.add(listener);

	return () => videoHubConnectedListeners.delete(listener);
}

// The `a` field on a socket event, so a report says which hub without the
// reader having to parse text.
const HUB_ORDINAL = {
	videoHub: 1,
	musicHub: 2,
	deviceHub: 3,
	pluginHub: 4,
} as const satisfies Record<HubName, number>;

function recordHubEvent(code: DiagnosticsCodeValue, name: HubName): void {
	recordDiagnostic(DiagnosticsCategory.Network, code, HUB_ORDINAL[name], 0, 0, name);
}

async function startWithRetry(hub: TypedHub, name: HubName, generation: number): Promise<void> {
	// stopRequested and hubGeneration are mutated outside this loop —
	// ESLint's static analysis can't follow async cross-call mutation.
	// eslint-disable-next-line no-unmodified-loop-condition
	while (!stopRequested && generation === hubGeneration) {
		try {
			recordHubEvent(DiagnosticsCode.SocketConnecting, name);
			await hub.start();
			recordHubEvent(DiagnosticsCode.SocketOpened, name);
			console.debug(`[socket] ${name} started`);

			if (name === 'videoHub') {
				announceVideoHubConnected();
			}

			return;
		} catch (err) {
			recordHubEvent(DiagnosticsCode.SocketFailed, name);
			console.warn(`[socket] ${name} start failed, retrying in 5s`, err);
			connectionState.value = 'reconnecting';
			await new Promise((r) => window.setTimeout(r, 5_000));
		}
	}
}

const queueRefresh = createRefreshBatcher(400, invalidateFromServer);

function bindRefreshLibrary(hub: TypedHub, name: HubName): void {
	hub.on('RefreshLibrary', (payload?: RefreshLibraryPayload) => {
		const serverKey = refreshKeyOf(payload);

		if (serverKey) {
			console.debug(`[socket] ${name} RefreshLibrary`, serverKey);
			queueRefresh(serverKey);
		}
	});
}

function bindDeviceList(hub: TypedHub): void {
	hub.on('DeviceListChanged', (devices: ConnectedDeviceSnapshot[] = []) => {
		playbackStore.devices.applyAccountDevices(devices);
	});
}

/**
 * Applies MusicPlayerState/VideoPlayerState/ConnectedDevicesState directly
 * into playbackStore, bound at hub-creation time rather than from within
 * the music/video engine bridges — those bridges attach only once their
 * npm player package finishes loading, well after the hub's initial
 * post-connect state push, which otherwise arrives to zero listeners.
 *
 * Wire shape is an EventPayload envelope (VideoPlayerEvents.cs), not a flat
 * message — only 'PlayerStateChanged' entries carry a snapshot, and `state`
 * is null on session end (server's universal stop signal). `seq` gates
 * out-of-order broadcasts the same way app-web's handleMusicPlayerState does.
 */
let lastAppliedMusicSeq = 0;
let lastAppliedVideoSeq = 0;

export function bindMusicPlayerState(hub: TypedHub): void {
	hub.on('MusicPlayerState', (payload?: MusicPlayerStateMsg) => {
		for (const e of payload?.events ?? []) {
			if (e.type !== 'PlayerStateChanged') continue;

			const state = e.event.state;

			if (!state) continue;

			if (state.seq && state.seq <= lastAppliedMusicSeq) continue;

			if (state.seq) {
				lastAppliedMusicSeq = state.seq;
			}

			if (state.item) {
				playbackStore.music.applyTrack(
					{
						id: String(state.item.id),
						name: state.item.name,
						artist: state.item.artist_track?.map((a) => a.name).filter(Boolean).join(', '),
						cover: state.item.cover,
						favorite: false,
						plugin_id: state.item.plugin_id ?? null,
						live: state.item.live ?? false,
						duration_ms: state.duration_ms,
					},
					playbackStore.music.queue.value,
				);
			}

			if (typeof state.is_playing === 'boolean') {
				playbackStore.music.applyPlayState(state.is_playing);
			}

			if (typeof state.progress_ms === 'number') {
				playbackStore.music.applyTime(state.progress_ms);
			}

			if (state.shuffle_state !== undefined) {
				playbackStore.music.applyShuffle(state.shuffle_state);
			}

			if (state.repeat_state !== undefined) {
				playbackStore.music.applyRepeat(state.repeat_state);
			}
		}
	});
}

function bindVideoPlayerState(hub: TypedHub): void {
	hub.on('VideoPlayerState', (payload?: VideoPlayerStateMsg) => {
		for (const e of payload?.events ?? []) {
			if (e.type !== 'PlayerStateChanged') continue;

			const state = e.event.state;

			if (!state) continue;

			if (state.seq && state.seq <= lastAppliedVideoSeq) continue;

			if (state.seq) {
				lastAppliedVideoSeq = state.seq;
			}

			if (state.item) {
				playbackStore.video.applyState({
					type: 'movie',
					id: String(state.item.id),
					title: state.item.title,
					duration_ms: state.duration_ms,
				});
			}

			if (typeof state.is_playing === 'boolean') {
				playbackStore.video.applyPlayState(state.is_playing);
			}

			if (typeof state.progress_ms === 'number') {
				playbackStore.video.applyTime(state.progress_ms);
			}
		}
	});
}

function bindConnectedDevices(hub: TypedHub): void {
	hub.on('ConnectedDevicesState', (devices: ConnectedDeviceSnapshot[] = []) => {
		playbackStore.music.applyConnectedDevices(devices);
	});
}

/**
 * A plugin saying its data, or the account's access to it, changed.
 *
 * The message itself is not drawn. The receiver re-reads the placements and
 * every view drawn from them, because a plugin that pushed a row this build
 * has never met would otherwise have to be understood here as well as on the
 * server, and the two would drift.
 */
function bindPluginMessage(hub: TypedHub): void {
	hub.on('PluginMessage', (message?: { pluginId?: string; type?: string }) => {
		console.debug(`[socket] pluginHub PluginMessage`, message?.pluginId, message?.type);
		invalidatePlugins();
	});
}

function bindLifecycle(hub: TypedHub, name: HubName): void {
	const conn = hub.raw();

	conn.onreconnecting(() => {
		// A reconnect attempt is its own transition. Recorded as a failure, a
		// hub that dropped and recovered read as a hub that never came back.
		recordHubEvent(DiagnosticsCode.SocketReconnecting, name);
		connectionState.value = 'reconnecting';
		console.debug(`[socket] ${name} reconnecting`);
	});

	conn.onreconnected(() => {
		recordHubEvent(DiagnosticsCode.SocketOpened, name);
		connectionState.value = 'connected';
		console.debug(`[socket] ${name} reconnected — invalidating library cache`);
		invalidateAllLibrary();

		if (name === 'videoHub') {
			announceVideoHubConnected();
		}

		// Every PluginMessage sent while the socket was down is gone. The wall
		// re-reads rather than waiting for the next push, which for a plugin
		// that pushes once an hour is an hour of a row nobody may see any more.
		if (name === 'pluginHub') {
			invalidatePlugins();
		}
	});

	conn.onclose((err) => {
		// With forever-retry, onclose only fires after explicit stop().
		recordHubEvent(DiagnosticsCode.SocketClosed, name);
		console.debug(`[socket] ${name} closed`, err);

		if (stopRequested) {
			connectionState.value = 'idle';
		}
	});
}

export async function connectAll(): Promise<void> {
	if (!authStore.serverUrl.value || !authStore.accessToken.value) {
		console.warn('[socket] connectAll called without auth — skipping');

		return;
	}

	const generation = ++hubGeneration;
	const previous = [videoHub.value, musicHub.value, deviceHub.value, pluginHub.value];

	stopRequested = false;
	connectionState.value = 'connecting';

	for (const old of previous) {
		void old?.stop().catch((error: Thrown) => recordSwallowed('connectAll', error));
	}

	videoHub.value = new TypedHub(buildHub('videoHub'));
	musicHub.value = new TypedHub(buildHub('musicHub'));
	deviceHub.value = new TypedHub(buildHub('deviceHub'));
	pluginHub.value = new TypedHub(buildHub('pluginHub'));

	// RefreshLibrary handlers wire on every hub since each hub's queue
	// emits its own invalidations.
	bindRefreshLibrary(videoHub.value, 'videoHub');
	bindRefreshLibrary(musicHub.value, 'musicHub');
	bindRefreshLibrary(deviceHub.value, 'deviceHub');
	bindDeviceList(deviceHub.value);
	bindMusicPlayerState(musicHub.value);
	bindConnectedDevices(musicHub.value);
	bindConnectedDevices(videoHub.value);
	bindConnectedDevices(deviceHub.value);
	bindVideoPlayerState(videoHub.value);
	bindLifecycle(videoHub.value, 'videoHub');
	bindLifecycle(musicHub.value, 'musicHub');
	bindLifecycle(deviceHub.value, 'deviceHub');
	bindPluginMessage(pluginHub.value);
	bindLifecycle(pluginHub.value, 'pluginHub');

	await Promise.all([
		startWithRetry(videoHub.value, 'videoHub', generation),
		startWithRetry(musicHub.value, 'musicHub', generation),
		startWithRetry(deviceHub.value, 'deviceHub', generation),
		startWithRetry(pluginHub.value, 'pluginHub', generation),
	]);

	if (generation === hubGeneration) {
		connectionState.value = 'connected';
	}
}

export async function disconnectAll(): Promise<void> {
	stopRequested = true;

	await Promise.all(
		[videoHub.value, musicHub.value, deviceHub.value, pluginHub.value].map((h) =>
			h
				? h.stop().catch((error: Thrown) => recordSwallowed('disconnectAll', error))
				: Promise.resolve(),
		),
	);

	videoHub.value = null;
	musicHub.value = null;
	deviceHub.value = null;
	pluginHub.value = null;
	connectionState.value = 'idle';
}

/** Foreground resume sweep wired to visibilitychange in main.ts. */
export function onForegroundResume(): void {
	// NoMercyApplication.kt:765-777: no connection check; a mid-reconnect hub still needs the refresh.
	invalidateAllLibrary();
}

export const socketStore = {
	connectionState,
	videoHub,
	musicHub,
	deviceHub,
	pluginHub,
	connectAll,
	disconnectAll,
	onForegroundResume,
	onVideoHubConnected,
	announceVideoHubConnected,
};
