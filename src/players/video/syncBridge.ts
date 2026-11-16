import type { NMVideoPlayer } from '@nomercy-entertainment/nomercy-video-player';
import { socketStore } from '@/stores/socketStore';
import { playbackStore } from '@/stores/playbackStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';
import type { DiagnosticsEngine } from '@/lib/diagnostics/playerEvents';
import { attachEngineDiagnostics } from '@/lib/diagnostics/playerEvents';

type Throttled<T extends (...args: never[]) => void> = T;

function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): Throttled<T> {
	let last = 0;
	let pending: ReturnType<typeof setTimeout> | null = null;

	return ((...args: never[]) => {
		const now = Date.now();

		if (now - last >= ms) {
			last = now;
			fn(...args);
		} else if (pending === null) {
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

type VideoEngineLike = NMVideoPlayer;

// The server's /watch item carries ids the player's item type does not name,
// in snake_case; the player passes them through unchanged.
interface WireItem {
	id: number | string;
	video_id?: string;
	playlist_type?: string;
	playlist_id?: string | number;
	tmdb_id?: string | number;
	type?: string;
	tmdbId?: string | number;
}

let engine: VideoEngineLike | null = null;
const unsubs: Array<() => void> = [];

// "PlaybackStalled 12" says nothing; "PlaybackStalled tv-1399 s3e9" names the
// episode whose report this is.
function mediaLabel(p: VideoEngineLike): string | undefined {
	const item = p.item() as WireItem | undefined;

	if (!item)
		return undefined;

	const kind = item.type ?? 'video';

	return `${kind}-${item.tmdbId ?? item.id}`;
}

// The server can refuse a command. The refusal is one diagnostics line; playback state stays as it is.
function guard(where: string, sent: Promise<unknown> | undefined): void {
	void Promise.resolve(sent).catch((error: unknown) => recordSwallowed(where, error));
}

// The server keeps one player state per user, filled only by StartPlaybackCommand, and a seek
// saves progress to whatever item that state names. The item is reported before any command.
let started: { id: number | string; taken: Promise<unknown> } | null = null;

function reportStart(p: VideoEngineLike): Promise<unknown> | undefined {
	const item = p.item() as WireItem | undefined;
	const hub = socketStore.videoHub.value;

	if (!hub || !item?.id || !item.playlist_type || item.playlist_id === undefined)
		return undefined;

	const taken = Promise.resolve(hub.invoke('StartPlaybackCommand', item.playlist_type, item.playlist_id, Number(item.id)));
	const mine = { id: item.id, taken };

	started = mine;

	taken.catch((error: unknown) => {
		recordSwallowed('syncStartPlayback', error);

		if (started === mine) {
			started = null;
		}
	});

	return taken;
}

// Runs `send` once the server has taken the start of the item that plays now.
function afterStart(p: VideoEngineLike, send: () => void): void {
	const item = p.item() as WireItem | undefined;
	const taken = started && started.id === item?.id
		? started.taken
		: reportStart(p);

	void taken?.then(send, () => {});
}

function bindOutbound(p: VideoEngineLike): void {
	started = null;

	const onItem = (): void => {
		reportStart(p);
	};

	const onPlay = (): void => {
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStarted, 0, 0, 0, mediaLabel(p));

		afterStart(p, () =>
			guard('syncPlaybackCommand', socketStore.videoHub.value?.invoke('PlaybackCommand', 'play', null)));

		playbackStore.video.applyPlayState(true);
	};

	const onPause = (): void => {
		afterStart(p, () =>
			guard('syncPlaybackCommand', socketStore.videoHub.value?.invoke('PlaybackCommand', 'pause', null)));

		playbackStore.video.applyPlayState(false);
	};

	const onSeek = (...args: unknown[]): void => {
		const data = args[0] as { time: number };

		afterStart(p, () =>
			guard('syncPlaybackCommand', socketStore.videoHub.value?.invoke('PlaybackCommand', 'seek', Math.round(data.time))));
	};

	const onTime = throttle((...args: unknown[]) => {
		const seconds = (args[0] as { time?: number } | undefined)?.time ?? 0;

		playbackStore.video.applyTime(Math.round(seconds * 1000));
		const item = p.item() as WireItem | undefined;

		if (!item) return;

		guard('syncSetTime', socketStore.videoHub.value?.invoke('SetTime', {
			// The server's VideoProgressRequest reads these snake_case names.
			video_id: item.video_id,
			playlist_type: item.playlist_type,
			playlist_id: item.playlist_id,
			tmdb_id: item.tmdb_id,
			time: Math.round(seconds),
			audio: p.audioTrack()?.track.language ?? '',
			subtitle: p.subtitle()?.track.language ?? '',
			subtitle_type: p.subtitle()?.track.type ?? '',
		}));
	}, 5000);

	p.on('item', onItem);
	p.on('play', onPlay);
	p.on('pause', onPause);
	p.on('seek', onSeek);
	p.on('time', onTime);
	const offConnected = socketStore.onVideoHubConnected(() => {
		started = null;
		reportStart(p);
	});

	unsubs.push(
		offConnected,
		() => p.off('item', onItem),
		() => p.off('play', onPlay),
		() => p.off('pause', onPause),
		() => p.off('seek', onSeek),
		() => p.off('time', onTime),
	);
}

// Every event the engine emits, not the five that once looked interesting.
// See specs/nomercy-app-kmp/diagnostics-capture-everything.md.
function bindDiagnostics(p: VideoEngineLike): number {
	return attachEngineDiagnostics(p as DiagnosticsEngine, () => mediaLabel(p), unsubs);
}

function bindInbound(p: VideoEngineLike): void {
	const hub = socketStore.videoHub.value;

	if (!hub) return;

	const onPlay = (): void => {
		recordDiagnostic(DiagnosticsCategory.Input, DiagnosticsCode.PlayPressed, 0, 0, 0, mediaLabel(p));
		void p.play();
	};

	const onPause = (): void => void p.pause();

	const onSeek = (...args: unknown[]): void => {
		const data = args[0] as { time: number };

		void p.time(data.time);
	};

	const onStop = (): void => void p.stop();
	const onNext = (): void => void p.next();
	const onPrev = (): void => void p.previous();

	const onLoad = (...args: unknown[]): void => {
		const data = args[0] as { playlist: unknown[]; item?: { id?: string | number; type?: unknown } };
		const item = data.item;
		const label = item?.id === undefined
			? 'video playlist'
			: `${item.type ?? 'video'}-${String(item.id)}`;

		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested, 0, 0, 0, label);
		p.playNow(data.playlist as never, item?.id);
	};

	const onVol = (...args: unknown[]): void => {
		const data = args[0] as { volume: number };

		void p.volume(data.volume);
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
			} catch (error) {
				// best-effort cleanup
				recordSwallowed('videoSyncBridgeDetach', error);
			}
		}

		engine = null;
	},
	current(): VideoEngineLike | null {
		return engine;
	},
};
