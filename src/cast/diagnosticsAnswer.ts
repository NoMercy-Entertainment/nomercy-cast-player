import { diagnosticsRing } from '@/lib/diagnostics/sink';

const CODECS = [
	'video/mp4; codecs="hvc1.2.4.L120.B0"',
	'video/mp4; codecs="hev1.2.4.L120.B0"',
	'video/mp4; codecs="avc1.640028"',
	'video/mp4; codecs="avc1.4d401f"',
	'audio/mp4; codecs="mp4a.40.2"',
] as const;

const LAST_EVENTS = 60;

function ranges(range: TimeRanges): Array<[number, number]> {
	const out: Array<[number, number]> = [];
	for (let i = 0; i < range.length; i++)
		out.push([range.start(i), range.end(i)]);
	return out;
}

/** Only what a sender needs to see why playback stalls: no tokens, no server address. */
export function buildDiagnosticsAnswer(): Record<string, unknown> {
	const mse = (globalThis as { MediaSource?: { isTypeSupported: (type: string) => boolean } }).MediaSource;
	const videos = Array.from(document.querySelectorAll('video')).map(video => ({
		paused: video.paused,
		currentTime: video.currentTime,
		duration: Number.isFinite(video.duration) ? video.duration : null,
		readyState: video.readyState,
		networkState: video.networkState,
		error: video.error ? { code: video.error.code, message: video.error.message } : null,
		buffered: ranges(video.buffered),
		srcKind: video.currentSrc.startsWith('blob:') ? 'mse' : video.currentSrc ? 'url' : 'none',
	}));
	return {
		route: window.location.pathname,
		userAgent: navigator.userAgent,
		videos,
		codecs: Object.fromEntries(CODECS.map(type => [type, mse?.isTypeSupported(type) ?? null])),
		events: diagnosticsRing.snapshot().slice(-LAST_EVENTS),
	};
}
