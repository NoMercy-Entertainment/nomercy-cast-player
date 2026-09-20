import { socketStore } from '@/stores/socketStore';
import { playbackStore } from '@/stores/playbackStore';
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

interface VideoEngineLike {
	on: (event: string, handler: (...args: unknown[]) => void) => void;
	off: (event: string, handler?: (...args: unknown[]) => void) => void;
	play: () => void;
	pause: () => void;
	seek: (seconds: number) => void;
	stop?: () => void;
	next?: () => void;
	previous?: () => void;
	loadPlaylist?: (playlist: unknown, item?: unknown) => void;
	// 1.x: volume(value) setter
	volume?: (v: number) => void;
	// 0.x deprecated shim
	setVolume?: (v: number) => void;
	playlistItem?: () => {
		id: number | string;
		videoId?: string;
		type?: string;
		listId?: string | number;
		tmdbId?: string | number;
	};
	// 1.x
	audioTrackIndex?: () => number | null;
	subtitleIndex?: () => number | null;
	// 0.x deprecated shims still present in 1.x
	getAudioTrack?: () => string | number | null;
	getSubtitleTrack?: () => string | number | null;
	getSubtitleType?: () => string | null;
}

let engine: VideoEngineLike | null = null;
const unsubs: Array<() => void> = [];

// "PlaybackStalled 12" says nothing; "PlaybackStalled tv-1399 s3e9" names the
// episode whose report this is.
function mediaLabel(p: VideoEngineLike): string | undefined {
	const item = p.playlistItem?.();
	if (!item)
		return undefined;

	const kind = item.type ?? 'video';
	return `${kind}-${item.tmdbId ?? item.id}`;
}

function bindOutbound(p: VideoEngineLike): void {
	const onPlay = (): void => {
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStarted, 0, 0, 0, mediaLabel(p));
		void socketStore.videoHub.value?.invoke('PlaybackCommand', 'play');
		playbackStore.video.applyPlayState(true);
	};
	const onPause = (): void => {
		void socketStore.videoHub.value?.invoke('PlaybackCommand', 'pause');
		playbackStore.video.applyPlayState(false);
	};
	const onSeek = (...args: unknown[]): void => {
		const t = args[0] as number;
		void socketStore.videoHub.value?.invoke('PlaybackCommand', 'seek', { time: t });
	};
	const onTime = throttle((...args: unknown[]) => {
		const data = args[0] as { currentTime?: number } | number;
		const seconds = typeof data === 'number' ? data : (data.currentTime ?? 0);
		playbackStore.video.applyTime(Math.round(seconds * 1000));
		const item = p.playlistItem?.();
		if (!item)
			return;
		void socketStore.videoHub.value?.invoke('SetTime', {
			VideoId: item.videoId,
			PlaylistType: item.type,
			PlaylistId: item.listId,
			TmdbId: item.tmdbId,
			Time: Math.round(seconds),
			Audio: p.audioTrackIndex?.() ?? p.getAudioTrack?.(),
			Subtitle: p.subtitleIndex?.() ?? p.getSubtitleTrack?.(),
			SubtitleType: p.getSubtitleType?.(),
		});
	}, 5000);

	p.on('play', onPlay);
	p.on('pause', onPause);
	p.on('seek', onSeek);
	p.on('time', onTime);

	unsubs.push(
		() => p.off('play', onPlay),
		() => p.off('pause', onPause),
		() => p.off('seek', onSeek),
		() => p.off('time', onTime),
	);
}

// The events that explain a playback fault nobody watched. `time` is left
// alone deliberately — it is the hot path.
const DIAGNOSTIC_PLAYBACK_EVENTS: Array<[string, DiagnosticsCodeValue]> = [
	['ready', DiagnosticsCode.Prepared],
	['waiting', DiagnosticsCode.Buffering],
	['stalled', DiagnosticsCode.PlaybackStalled],
	['ended', DiagnosticsCode.PlaybackEnded],
	['error', DiagnosticsCode.PlayerError],
];

function bindDiagnostics(p: VideoEngineLike): void {
	for (const [event, code] of DIAGNOSTIC_PLAYBACK_EVENTS) {
		const handler = (): void =>
			recordDiagnostic(DiagnosticsCategory.Playback, code, 0, 0, 0, mediaLabel(p));
		p.on(event, handler);
		unsubs.push(() => p.off(event, handler));
	}
}

function bindInbound(p: VideoEngineLike): void {
	const hub = socketStore.videoHub.value;
	if (!hub)
		return;

	const onPlay = (): void => {
		recordDiagnostic(DiagnosticsCategory.Input, DiagnosticsCode.PlayPressed, 0, 0, 0, mediaLabel(p));
		p.play();
	};
	const onPause = (): void => p.pause();
	const onSeek = (...args: unknown[]): void => {
		const data = args[0] as { time: number };
		p.seek(data.time);
	};
	const onStop = (): void => p.stop?.();
	const onNext = (): void => p.next?.();
	const onPrev = (): void => p.previous?.();
	const onLoad = (...args: unknown[]): void => {
		const data = args[0] as { playlist: unknown; item?: unknown };
		const item = data.item as { id?: unknown; type?: unknown } | undefined;
		const label = item?.id === undefined ? 'video playlist' : `${item.type ?? 'video'}-${String(item.id)}`;
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested, 0, 0, 0, label);
		p.loadPlaylist?.(data.playlist, data.item);
	};
	const onVol = (...args: unknown[]): void => {
		const data = args[0] as { volume: number };
		// 1.x: volume(value); 0.x: setVolume(value)
		p.volume?.(data.volume);
		p.setVolume?.(data.volume);
	};

	hub.on('Play', onPlay);
	hub.on('Pause', onPause);
	hub.on('Seek', onSeek);
	hub.on('Stop', onStop);
	hub.on('Next', onNext);
	hub.on('Previous', onPrev);
	hub.on('LoadMedia', onLoad);
	hub.on('SetVolume', onVol);

	unsubs.push(
		() => hub.off('Play', onPlay),
		() => hub.off('Pause', onPause),
		() => hub.off('Seek', onSeek),
		() => hub.off('Stop', onStop),
		() => hub.off('Next', onNext),
		() => hub.off('Previous', onPrev),
		() => hub.off('LoadMedia', onLoad),
		() => hub.off('SetVolume', onVol),
	);
}

export const videoSyncBridge = {
	attach(e: VideoEngineLike): void {
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
	current(): VideoEngineLike | null {
		return engine;
	},
};
