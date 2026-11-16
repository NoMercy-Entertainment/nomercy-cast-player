import { pendingCrashes } from '@/lib/diagnostics/crashHandler';
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

	for (let i = 0; i < range.length; i++) {
		out.push([range.start(i), range.end(i)]);
	}

	return out;
}

function osdText(): {
	visible: boolean;
	elapsed: string | null;
	remaining: string | null;
} | null {
	const osd = document.querySelector('.playback-osd');

	if (!osd)
		return null;

	return {
		visible: osd.classList.contains('is-visible'),
		elapsed: osd.querySelector('.osd-elapsed')?.textContent ?? null,
		remaining: osd.querySelector('.osd-remaining')?.textContent ?? null,
	};
}

// The surfaces a viewer can report as blank or covered. Class names and styles only, no text or URLs.
const LAYERS = [
	'.playback-osd',
	'.pre-screen',
	'.pre-screen-buttons button',
	'.tv-overlay-host',
	'.nm-hero-rails-screen',
	'.nm-hero-rails',
	'.nm-hero-rails [data-rail-id]',
	'.empty-state',
	'.error-panel',
	'video',
] as const;
const LAYER_ITEMS = 4;

function layers(): Record<string, unknown> {
	return Object.fromEntries(LAYERS.map((selector) => {
		const found = Array.from(document.querySelectorAll<HTMLElement>(selector));

		return [selector, {
			count: found.length,
			items: found.slice(0, LAYER_ITEMS).map((el) => {
				const style = getComputedStyle(el);
				const box = el.getBoundingClientRect();

				return {
					className: typeof el.className === 'string'
						? el.className
						: '',
					display: style.display,
					visibility: style.visibility,
					opacity: style.opacity,
					zIndex: style.zIndex,
					box: [box.x, box.y, box.width, box.height].map(Math.round),
					children: el.childElementCount,
				};
			}),
		}];
	}));
}

const FOCUS_LABEL = 40;

// Where the remote is: a TV screencap can be stale, the focused element is not.
function focus(): Record<string, unknown> | null {
	const el = document.activeElement as HTMLElement | null;

	if (!el || el === document.body || el === document.documentElement)
		return null;

	const label = el.getAttribute('aria-label') ?? el.textContent ?? '';

	return {
		tag: el.tagName.toLowerCase(),
		className: typeof el.className === 'string'
			? el.className
			: '',
		data: { ...el.dataset },
		label: label.replace(/\s+/g, ' ').trim().slice(0, FOCUS_LABEL - 1),
	};
}

/** Only what a sender needs to see why playback stalls: no tokens, no server address. */
export function buildDiagnosticsAnswer(): Record<string, unknown> {
	const mse = (globalThis as { MediaSource?: { isTypeSupported: (type: string) => boolean } }).MediaSource;
	const videos = Array.from(document.querySelectorAll('video')).map((video) => ({
		paused: video.paused,
		currentTime: video.currentTime,
		duration: Number.isFinite(video.duration)
			? video.duration
			: null,
		readyState: video.readyState,
		networkState: video.networkState,
		error: video.error
			? { code: video.error.code, message: video.error.message }
			: null,
		buffered: ranges(video.buffered),
		srcKind: video.currentSrc.startsWith('blob:')
			? 'mse'
			: video.currentSrc
				? 'url'
				: 'none',
	}));

	return {
		route: window.location.pathname,
		userAgent: navigator.userAgent,
		videos,
		osd: osdText(),
		codecs: Object.fromEntries(CODECS.map((type) => [type, mse?.isTypeSupported(type) ?? null])),
		crashes: pendingCrashes(),
		layers: layers(),
		focus: focus(),
		events: diagnosticsRing.snapshot().slice(-LAST_EVENTS),
	};
}
