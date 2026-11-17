import { throttle } from '@/lib/throttle';
import { socketStore } from '@/stores/socketStore';
import { playbackStore } from '@/stores/playbackStore';
import type { ConnectedDeviceSnapshot, CurrentTrackSnapshot } from '@/stores/playbackStore';
import { castDeviceId } from '@/lib/diagnostics/deviceId';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';
import type { DiagnosticsEngine } from '@/lib/diagnostics/playerEvents';
import { attachEngineDiagnostics } from '@/lib/diagnostics/playerEvents';

interface RawTrack {
	id?: string | number;
	name?: string;
	cover?: string;
	album_track?: Array<{
		name?: string;
		cover?: string;
		backdrop?: string | null;
		color_palette?: CurrentTrackSnapshot['color_palette'];
	}>;
	artist_track?: Array<{
		name?: string;
		backdrop?: string | null;
	}>;
	duration?: number | string;
	color_palette?: CurrentTrackSnapshot['color_palette'];
	favorite?: boolean;
	plugin_id?: string | null;
	live?: boolean;
}

interface MusicEvents {
	play: undefined;
	pause: { ended?: boolean } | undefined;
	next: undefined;
	previous: undefined;
	seek: number;
	time: { currentTime?: number; position?: number } | number;
	song: RawTrack | null;
	queue: RawTrack[] | undefined;
	shuffle: boolean;
	repeat: 'off' | 'all' | 'one';
	canplay: undefined;
	error: undefined;
}

export interface MusicEngineLike {
	on: <K extends keyof MusicEvents>(event: K, handler: (payload: MusicEvents[K]) => void) => void;
	off: <K extends keyof MusicEvents>(event: K, handler?: (payload: MusicEvents[K]) => void) => void;
	play: () => void | Promise<void>;
	pause: () => void;
	next: () => void;
	previous: () => void;
	seek: (seconds: number) => void;
	volume?: (percent: number) => void;
	currentTrack?: () => CurrentTrackSnapshot;
	currentSong?: { id?: string | number } | null;
	playTrack?: (track: ServerTrack, tracks?: ServerTrack[]) => void;
}

interface ServerTrack {
	id: string | number;
	path?: string;
	plugin_id?: string | null;
}

interface PlayerState {
	device_id?: string | null;
	device_volumes?: Record<string, number>;
	is_playing?: boolean;
	item?: ServerTrack | null;
	playlist?: ServerTrack[];
	progress_ms?: number;
}

// The wire is a bare state or an { events: [{ event: { state } }] } envelope.
interface StatePayload extends PlayerState {
	events?: Array<{ type?: string; event?: { state?: PlayerState | null } }>;
}

function toSnapshot(raw: RawTrack | null | undefined): CurrentTrackSnapshot | null {
	if (!raw)
		return null;

	const album = raw.album_track?.[0];
	const artist = raw.artist_track?.map((a) => a.name).filter(Boolean).join(', ') ?? '';
	const durationSec = typeof raw.duration === 'number'
		? raw.duration
		: Number(raw.duration ?? 0);
	const palette = raw.color_palette ?? album?.color_palette ?? null;
	const backdrop = album?.backdrop ?? raw.artist_track?.find((a) => a.backdrop)?.backdrop ?? null;

	return {
		id: String(raw.id ?? raw.name ?? Math.random()),
		name: raw.name ?? '',
		artist,
		album: album?.name,
		cover: raw.cover ?? album?.cover,
		backdrop,
		duration_ms: Number.isFinite(durationSec)
			? Math.round(durationSec * 1000)
			: undefined,
		color_palette: palette,
		favorite: raw.favorite ?? false,
		plugin_id: raw.plugin_id ?? null,
		live: raw.live ?? false,
	};
}

let engine: MusicEngineLike | null = null;
const unsubs: Array<() => void> = [];

// "PlaybackStalled" with no name cannot say which track stalled, which is the
// first thing anyone reading the report wants to know.
function trackLabel(p: MusicEngineLike): string | undefined {
	const track = p.currentTrack?.();

	if (!track)
		return undefined;

	return `track-${track.id}`;
}

// The device the server last named active in a MusicPlayerState push.
let activeDeviceId: string | null = null;

// Set while a server track loads into the engine; its autoplay and pause are
// the engine's own, not the user's, and the target position waits for canplay.
let pendingLoad: { seconds: number; playing: boolean } | null = null;

// MusicHub takes one PlaybackCommand(command, data) for every transport action
// (MusicPlaybackCommandHandler: play, pause, seek in seconds, next, previous).
// It applies the command to the user's one music session whoever sends it, so
// a receiver that is not the active device would start or stop another
// device's audio. Send only while the server names this receiver.
function sendCommand(command: string, data: number | null = null): void {
	if (activeDeviceId === null || activeDeviceId !== castDeviceId()) return;

	void socketStore.musicHub.value?.invoke('PlaybackCommand', command, data);
}

function bindOutbound(p: MusicEngineLike): void {
	// Player events → SignalR. Server tracks state, propagates to other senders.
	const onPlay = (): void => {
		const label = trackLabel(p);

		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStarted, 0, 0, 0, label);

		if (pendingLoad === null) {
			sendCommand('play');
		}

		playbackStore.music.applyPlayState(true);
	};

	const onPause = (audio: MusicEvents['pause']): void => {
		// The audio element also pauses when a track runs out or is swapped; neither is a user pause.
		if (!audio?.ended && pendingLoad === null) {
			sendCommand('pause');
		}

		playbackStore.music.applyPlayState(false);
	};

	const onNext = (): void => {
		sendCommand('next');
	};

	const onPrev = (): void => {
		sendCommand('previous');
	};

	const onSeek = (time: number): void => {
		sendCommand('seek', Math.round(time));
	};

	const onTime = throttle((data: MusicEvents['time']) => {
		const seconds = typeof data === 'number'
			? data
			: (data.position ?? data.currentTime ?? 0);

		playbackStore.music.applyTime(Math.round(seconds * 1000));
		const trackId = p.currentTrack?.()?.id;

		void socketStore.musicHub.value?.invoke('CurrentTimeForItemCommand', seconds, trackId === undefined
			? null
			: String(trackId));
	}, 5000);

	const onSong = (raw: RawTrack | null): void => {
		const snap = toSnapshot(raw);

		recordDiagnostic(
			DiagnosticsCategory.Playback,
			DiagnosticsCode.Prepared,
			0,
			0,
			0,
			snap
				? `track-${snap.id}`
				: undefined,
		);

		const queue = playbackStore.music.queue.value;

		playbackStore.music.applyTrack(snap, queue);
	};

	const onQueue = (raws: RawTrack[] | undefined): void => {
		const next = (raws ?? []).map(toSnapshot).filter((x): x is CurrentTrackSnapshot => x !== null);

		playbackStore.music.applyTrack(playbackStore.music.track.value, next);
	};

	const onShuffle = (on: boolean): void => {
		playbackStore.music.applyShuffle(Boolean(on));
	};

	const onRepeat = (mode: MusicEvents['repeat']): void => {
		playbackStore.music.applyRepeat(mode);
	};

	p.on('play', onPlay);
	p.on('pause', onPause);
	p.on('next', onNext);
	p.on('previous', onPrev);
	p.on('seek', onSeek);
	p.on('time', onTime);
	p.on('song', onSong);
	p.on('queue', onQueue);
	p.on('shuffle', onShuffle);
	p.on('repeat', onRepeat);

	unsubs.push(
		() => p.off('play', onPlay),
		() => p.off('pause', onPause),
		() => p.off('next', onNext),
		() => p.off('previous', onPrev),
		() => p.off('seek', onSeek),
		() => p.off('time', onTime),
		() => p.off('song', onSong),
		() => p.off('queue', onQueue),
		() => p.off('shuffle', onShuffle),
		() => p.off('repeat', onRepeat),
	);
}

// Every event the engine emits, not the four that once looked interesting.
// See specs/nomercy-app-kmp/diagnostics-capture-everything.md.
function bindDiagnostics(p: MusicEngineLike): number {
	return attachEngineDiagnostics(p as DiagnosticsEngine, () => trackLabel(p), unsubs);
}

function applyOwnVolume(p: MusicEngineLike, payload: StatePayload | null): void {
	const state = payload?.events?.at(-1)?.event?.state ?? payload;
	const own = state?.device_volumes?.[castDeviceId()];

	if (typeof own === 'number') {
		const percent = Math.min(100, own);

		p.volume?.(Math.max(0, percent));
	}
}

async function playEngine(p: MusicEngineLike): Promise<void> {
	try {
		await p.play();
	} catch (error) {
		recordSwallowed('musicEnginePlay', error);
	}
}

// MusicHub names the device and the track but never pushes audio, so this
// device loads, seeks and plays the track itself while it is the active one.
function applyServerState(
	p: MusicEngineLike,
	state: PlayerState | null | undefined,
	wasOwn: boolean,
): void {
	if (activeDeviceId !== castDeviceId()) {
		if (wasOwn) {
			pendingLoad = null;
			p.pause();
		}

		return;
	}

	const item = state?.item;

	if (!item?.path || item.plugin_id) return;

	const target = { seconds: (state?.progress_ms ?? 0) / 1000, playing: state?.is_playing === true };

	if (String(p.currentSong?.id) !== String(item.id)) {
		const rest = (state?.playlist ?? []).filter((track) => String(track.id) !== String(item.id));
		const queue = [item, ...rest];

		pendingLoad = target;
		p.playTrack?.(item, queue);

		return;
	}

	if (pendingLoad !== null) {
		pendingLoad = target;

		return;
	}

	if (!wasOwn) {
		p.seek(target.seconds);
	}

	if (target.playing) {
		void playEngine(p);
	} else {
		p.pause();
	}
}

function bindInbound(p: MusicEngineLike): void {
	const hub = socketStore.musicHub.value;

	if (!hub) return;

	const onState = (payload: StatePayload | null): void => {
		const changed = [...payload?.events ?? []].reverse().find((entry) => entry.type === 'PlayerStateChanged');
		const state = payload?.events
			? changed?.event?.state
			: payload;
		const wasOwn = activeDeviceId === castDeviceId();

		activeDeviceId = state?.device_id ?? null;
		applyOwnVolume(p, payload);
		applyServerState(p, state, wasOwn);
	};

	const onCanPlay = (): void => {
		const target = pendingLoad;

		pendingLoad = null;

		if (!target) return;

		if (target.seconds > 0) {
			p.seek(target.seconds);
		}

		if (target.playing) {
			void playEngine(p);
		} else {
			p.pause();
		}
	};

	const onLoadFailed = (): void => {
		pendingLoad = null;
	};

	p.on('canplay', onCanPlay);
	p.on('error', onLoadFailed);

	const onConnectedDevices = (devices: ConnectedDeviceSnapshot[] | undefined): void => {
		playbackStore.music.applyConnectedDevices(devices ?? []);
	};

	hub.on('MusicPlayerState', onState);
	hub.on('ConnectedDevicesState', onConnectedDevices);

	unsubs.push(
		() => p.off('canplay', onCanPlay),
		() => p.off('error', onLoadFailed),
		() => hub.off('MusicPlayerState', onState),
		() => hub.off('ConnectedDevicesState', onConnectedDevices),
	);
}

export const musicSyncBridge = {
	attach(e: MusicEngineLike): void {
		engine = e;
		bindOutbound(e);
		bindDiagnostics(e);
		bindInbound(e);
	},
	detach(): void {
		while (unsubs.length > 0) {
			const fn = unsubs.pop();

			try {
				fn?.();
			} catch (error) {
				// best-effort cleanup
				recordSwallowed('musicSyncBridgeDetach', error);
			}
		}

		engine = null;
		activeDeviceId = null;
		pendingLoad = null;
	},
	current(): MusicEngineLike | null {
		return engine;
	},
};
