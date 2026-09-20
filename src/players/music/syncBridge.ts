import { socketStore } from '@/stores/socketStore';
import { playbackStore } from '@/stores/playbackStore';
import type { ConnectedDeviceSnapshot, CurrentTrackSnapshot } from '@/stores/playbackStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import type { DiagnosticsCodeValue } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

type Throttled<T extends (...args: never[]) => void> = T;

function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): Throttled<T> {
	let last = 0;
	let pending: ReturnType<typeof setTimeout> | null = null;
	return ((...args: never[]) => {
		const now = Date.now();
		if (now - last >= ms) {
			last = now;
			fn(...args);
		}
		else if (pending === null) {
			pending = setTimeout(
				() => {
					last = Date.now();
					pending = null;
					fn(...args);
				},
				ms - (now - last),
			);
		}
	}) as Throttled<T>;
}

interface MusicEngineLike {
	on: (event: string, handler: (...args: unknown[]) => void) => void;
	off: (event: string, handler?: (...args: unknown[]) => void) => void;
	play: () => void;
	pause: () => void;
	next: () => void;
	previous: () => void;
	seek: (seconds: number) => void;
	loadTrack?: (data: unknown) => void;
	applyServerState?: (state: unknown) => void;
	currentTrack?: () => CurrentTrackSnapshot;
}

interface RawTrack {
	id?: string | number;
	name?: string;
	cover?: string;
	album_track?: Array<{ name?: string; cover?: string; backdrop?: string | null; color_palette?: unknown; [k: string]: unknown }>;
	artist_track?: Array<{ name?: string; backdrop?: string | null; [k: string]: unknown }>;
	duration?: number | string;
	color_palette?: unknown;
	favorite?: boolean;
	[k: string]: unknown;
}

function toSnapshot(raw: RawTrack | null | undefined): CurrentTrackSnapshot | null {
	if (!raw)
		return null;
	const album = raw.album_track?.[0];
	const artist = raw.artist_track?.map(a => a.name).filter(Boolean).join(', ') ?? '';
	const durationSec = typeof raw.duration === 'number'
		? raw.duration
		: Number(raw.duration ?? 0);
	const palette = (raw.color_palette ?? album?.color_palette ?? null) as
		CurrentTrackSnapshot['color_palette'];
	const backdrop = (album?.backdrop ?? raw.artist_track?.find(a => a.backdrop)?.backdrop) ?? null;
	return {
		id: String(raw.id ?? raw.name ?? Math.random()),
		name: raw.name ?? '',
		artist,
		album: album?.name,
		cover: raw.cover ?? album?.cover,
		backdrop,
		duration_ms: Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : undefined,
		color_palette: palette,
		favorite: raw.favorite ?? false,
	};
}

let engine: MusicEngineLike | null = null;
const unsubs: Array<() => void> = [];

function bindOutbound(p: MusicEngineLike): void {
	// Player events → SignalR. Server tracks state, propagates to other senders.
	const onPlay = (): void => {
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStarted);
		void socketStore.musicHub.value?.invoke('PlayCommand');
		playbackStore.music.applyPlayState(true);
	};
	const onPause = (): void => {
		void socketStore.musicHub.value?.invoke('PauseCommand');
		playbackStore.music.applyPlayState(false);
	};
	const onNext = (): void => {
		void socketStore.musicHub.value?.invoke('NextCommand');
	};
	const onPrev = (): void => {
		void socketStore.musicHub.value?.invoke('PreviousCommand');
	};
	const onSeek = (...args: unknown[]): void => {
		const t = args[0] as number;
		void socketStore.musicHub.value?.invoke('SeekCommand', Math.round(t * 1000));
	};
	const onTime = throttle((...args: unknown[]) => {
		const data = args[0] as { currentTime?: number; position?: number } | number;
		const seconds = typeof data === 'number' ? data : (data.position ?? data.currentTime ?? 0);
		playbackStore.music.applyTime(Math.round(seconds * 1000));
		void socketStore.musicHub.value?.invoke('SetTimeCommand', {
			Time: Math.round(seconds * 1000),
			TrackId: p.currentTrack?.()?.id,
		});
	}, 5000);
	const onSong = (...args: unknown[]): void => {
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.Prepared);
		const raw = args[0] as RawTrack | null;
		const snap = toSnapshot(raw);
		const queue = playbackStore.music.queue.value;
		playbackStore.music.applyTrack(snap, queue);
	};
	const onQueue = (...args: unknown[]): void => {
		const raws = (args[0] ?? []) as RawTrack[];
		const next = raws.map(toSnapshot).filter((x): x is CurrentTrackSnapshot => x !== null);
		playbackStore.music.applyTrack(playbackStore.music.track.value, next);
	};
	const onShuffle = (...args: unknown[]): void => {
		playbackStore.music.applyShuffle(Boolean(args[0]));
	};
	const onRepeat = (...args: unknown[]): void => {
		const mode = args[0] as 'off' | 'all' | 'one';
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

// The events that explain a music fault nobody watched. `time` is left alone
// deliberately — it is the hot path.
const DIAGNOSTIC_PLAYBACK_EVENTS: Array<[string, DiagnosticsCodeValue]> = [
	['waiting', DiagnosticsCode.Buffering],
	['stalled', DiagnosticsCode.PlaybackStalled],
	['ended', DiagnosticsCode.PlaybackEnded],
	['error', DiagnosticsCode.PlayerError],
];

function bindDiagnostics(p: MusicEngineLike): void {
	for (const [event, code] of DIAGNOSTIC_PLAYBACK_EVENTS) {
		const handler = (): void => recordDiagnostic(DiagnosticsCategory.Playback, code);
		p.on(event, handler);
		unsubs.push(() => p.off(event, handler));
	}
}

function bindInbound(p: MusicEngineLike): void {
	const hub = socketStore.musicHub.value;
	if (!hub)
		return;

	const onPlay = (): void => p.play();
	const onPause = (): void => p.pause();
	const onNext = (): void => p.next();
	const onPrev = (): void => p.previous();
	const onSeek = (...args: unknown[]): void => p.seek((args[0] as number) / 1000);
	const onLoad = (...args: unknown[]): void => p.loadTrack?.(args[0]);
	const onState = (...args: unknown[]): void => p.applyServerState?.(args[0]);
	const onConnectedDevices = (...args: unknown[]): void => {
		const devices = (args[0] ?? []) as ConnectedDeviceSnapshot[];
		playbackStore.music.applyConnectedDevices(devices);
	};

	hub.on('Play', onPlay);
	hub.on('Pause', onPause);
	hub.on('Next', onNext);
	hub.on('Previous', onPrev);
	hub.on('Seek', onSeek);
	hub.on('LoadTrack', onLoad);
	hub.on('MusicPlayerState', onState);
	hub.on('ConnectedDevicesState', onConnectedDevices);

	unsubs.push(
		() => hub.off('Play', onPlay),
		() => hub.off('Pause', onPause),
		() => hub.off('Next', onNext),
		() => hub.off('Previous', onPrev),
		() => hub.off('Seek', onSeek),
		() => hub.off('LoadTrack', onLoad),
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
			}
			catch {
				// best-effort cleanup
			}
		}
		engine = null;
	},
	current(): MusicEngineLike | null {
		return engine;
	},
};
