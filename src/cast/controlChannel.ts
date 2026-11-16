/**
 * The TV control contract (nomercy-app-kmp api/openapi.yaml, /v1/...) answered over the
 * Cast custom channel, so the phone's cast remote drives this receiver like a native TV.
 */

export interface ControlRequest {
	id: number;
	method: string;
	path: string;
	body?: unknown;
}

export interface ControlResponse {
	id: number;
	status: number;
	body: unknown;
}

interface Track { label?: string; language?: string }
interface Level { label?: string; height?: number; bitrate?: number }
interface Item {
	id?: string | number;
	title?: string;
	name?: string;
	show?: string;
	season?: number | null;
	episode?: number | null;
	image?: string | null;
	description?: string | null;
	overview?: string | null;
	duration?: number | string;
}

export interface ControlEngine {
	playState: () => string;
	time: { (): number; (seconds: number): Promise<void> | void };
	duration: () => number;
	volume: { (): number; (level: number): Promise<void> | void };
	volumeState: () => string;
	toggleMute: () => void;
	item: () => Item | undefined;
	index: () => number;
	queue: () => ReadonlyArray<Item>;
	seekToIndex: (index: number) => void;
	play: () => Promise<void>;
	pause: () => Promise<void>;
	stop: () => Promise<void>;
	next: () => Promise<void>;
	previous: () => Promise<void>;
	audioTracks: () => Track[];
	audioTrack: { (): { index: number } | null; (index: number): Promise<void> | void };
	subtitles: () => Track[];
	subtitle: { (): { index: number } | null; (index: number | null): Promise<void> | void };
	qualityLevels: () => Level[];
	quality: { (): { index: number } | 'auto'; (index: number | 'auto'): void };
}

const PLAYBACK_STATE = {
	playing: 'playing',
	paused: 'paused',
	loading: 'buffering',
	stopped: 'ended',
	idle: 'idle',
	error: 'idle',
} as const satisfies Record<string, string>;

function isEpisode(item: Item | undefined): boolean {
	return item?.season != null && item?.episode != null;
}

// The server sends duration as seconds or as "HH:MM:SS".
function durationMs(value: Item['duration']): number {
	if (typeof value === 'number')
		return Math.round(value * 1000);

	if (typeof value !== 'string')
		return 0;

	const seconds = value.split(':').reduce((total, part) => total * 60 + Number(part), 0);

	return Number.isFinite(seconds)
		? seconds * 1000
		: 0;
}

function playlistItem(item: Item) {
	const episode = isEpisode(item);

	return {
		id: String(item.id ?? ''),
		kind: episode
			? 'episode'
			: 'movie',
		title: item.title ?? item.name ?? '',
		...(item.show
			? { showTitle: item.show }
			: {}),
		...(episode
			? { season: Number(item.season), episode: Number(item.episode) }
			: {}),
		overview: item.overview ?? item.description ?? '',
		durationMs: durationMs(item.duration),
		posterUrl: item.image ?? '',
	};
}

function track(t: Track) {
	return { label: t.label ?? t.language ?? '', ...(t.language
		? { language: t.language }
		: {}) };
}

function level(l: Level) {
	return {
		label: l.label ?? (l.height
			? `${l.height}p`
			: ''),
		...(l.height !== undefined
			? { height: l.height }
			: {}),
		...(l.bitrate !== undefined
			? { bitrate: l.bitrate }
			: {}),
	};
}

function session(e: ControlEngine) {
	const item = e.item();
	const audio = e.audioTrack();
	const subtitle = e.subtitle();

	return {
		sessionId: String(item?.id ?? ''),
		playbackState: PLAYBACK_STATE[e.playState()] ?? 'idle',
		positionMs: Math.max(0, Math.round(e.time() * 1000)),
		durationMs: Math.max(0, Math.round(e.duration() * 1000)),
		itemId: String(item?.id ?? ''),
		itemKind: item
			? (isEpisode(item)
					? 'episode'
					: 'movie')
			: 'none',
		itemTitle: item?.title ?? item?.name ?? '',
		audioTrackId: audio
			? String(audio.index)
			: '',
		subtitleTrackId: subtitle
			? String(subtitle.index)
			: '',
		subtitleEnabled: subtitle !== null,
		qualityLevel: e.quality() === 'auto'
			? 'auto'
			: 'high',
		volume: Math.min(1, Math.max(0, e.volume() / 100)),
		muted: e.volumeState() === 'muted',
		playlistActiveIndex: e.index(),
		playlistLength: e.queue().length,
	};
}

function tracks(e: ControlEngine) {
	const quality = e.quality();

	return {
		audio: e.audioTracks().map(track),
		subtitle: e.subtitles().map(track),
		quality: e.qualityLevels().map(level),
		currentAudioIndex: e.audioTrack()?.index ?? -1,
		currentSubtitleIndex: e.subtitle()?.index ?? -1,
		currentQualityIndex: quality === 'auto'
			? 0
			: quality.index,
	};
}

async function setVolume(e: ControlEngine, body: {
	level?: number;
	delta?: number;
	muted?: boolean;
}): Promise<void> {
	if (body.muted) {
		e.toggleMute();

		return;
	}

	const current = e.volume();
	const target = body.delta
		? current + body.delta * 100
		: (body.level ?? current / 100) * 100;

	await e.volume(Math.round(Math.min(100, Math.max(0, target))));
}

type Body = Record<string, unknown>;
type Handler = (e: ControlEngine, body: Body) => Promise<unknown> | unknown;

const NO_CONTENT = Symbol('no content');
const V1_PREFIX = /^\/v1(?=\/)/;

// A command answers 204 once the player took it.
function command(fn: Handler): Handler {
	return async (e, b) => {
		await fn(e, b);

		return NO_CONTENT;
	};
}

const ROUTES = {
	'GET /session': (e) => session(e),
	'GET /session/tracks': (e) => tracks(e),
	'GET /session/playlist': (e) => ({ items: e.queue().map(playlistItem), activeIndex: e.index() }),
	'POST /session/transport/play': command((e) => e.play()),
	'POST /session/transport/pause': command((e) => e.pause()),
	'POST /session/transport/stop': command((e) => e.stop()),
	'POST /session/transport/next': command((e) => e.next()),
	'POST /session/transport/previous': command((e) => e.previous()),
	'POST /session/transport/seek': command((e, b) => e.time(Number(b.positionMs ?? 0) / 1000)),
	'PATCH /session/volume': command((e, b) => setVolume(e, b)),
	'PATCH /session/audio': command((e, b) => e.audioTrack(Number(b.trackId))),
	'PATCH /session/subtitle': command((e, b) => e.subtitle(b.enabled === false || b.trackId === ''
		? null
		: Number(b.trackId))),
	'PATCH /session/quality': command((e, b) => e.quality(b.level === 'auto'
		? 'auto'
		: 0)),
	'PATCH /session/playlist': command((e, b) => e.seekToIndex(Number(b.activeIndex))),
} as const satisfies Record<string, Handler>;

export async function answerControl(req: ControlRequest, engine: ControlEngine | null): Promise<ControlResponse> {
	const path = req.path.replace(V1_PREFIX, '');
	const method = req.method.toUpperCase();

	if (method === 'GET' && path === '/ping') {
		return {
			id: req.id,
			status: 200,
			body: { ok: true },
		};
	}

	const handler = ROUTES[`${method} ${path}`];

	if (!handler) {
		return {
			id: req.id,
			status: 404,
			body: null,
		};
	}

	if (!engine) {
		return {
			id: req.id,
			status: 412,
			body: null,
		};
	}

	try {
		const result = await handler(engine, (req.body ?? {}) as Body);

		return result === NO_CONTENT
			? {
					id: req.id,
					status: 204,
					body: null,
				}
			: {
					id: req.id,
					status: 200,
					body: result,
				};
	} catch (error) {
		return {
			id: req.id,
			status: 500,
			body: { title: String(error) },
		};
	}
}

export function isControlRequest(data: unknown): data is { control: ControlRequest } {
	const control = (data as { control?: Partial<ControlRequest> } | null)?.control;

	return typeof control?.id === 'number' && typeof control.method === 'string' && typeof control.path === 'string';
}
