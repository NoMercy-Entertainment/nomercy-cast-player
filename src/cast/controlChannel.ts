/**
 * The TV control contract (nomercy-app-kmp api/openapi.yaml, /v1/...) answered over the
 * Cast custom channel, so the phone's cast remote drives this receiver like a native TV.
 */

import { clampVolume } from '@nomercy-entertainment/nomercy-player-core';

type Body = Record<string, string | number | boolean | null | undefined>;
type ResponseBody = object | null;

export interface ControlRequest {
	id: number;
	method: string;
	path: string;
	body?: Body;
}

export interface ControlResponse {
	id: number;
	status: number;
	body: ResponseBody;
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

function isPlaybackState(state: string): state is keyof typeof PLAYBACK_STATE {
	return Object.hasOwn(PLAYBACK_STATE, state);
}

function isEpisode(item: Item | undefined): boolean {
	return item?.season != null && item?.episode != null;
}

function itemKind(item: Item | undefined): string {
	if (!item)
		return 'none';

	return isEpisode(item)
		? 'episode'
		: 'movie';
}

function toMilliseconds(seconds: number): number {
	return Math.max(0, Math.round(seconds * 1000));
}

function toUnitVolume(percent: number): number {
	return Math.min(1, Math.max(0, percent / 100));
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
	const state = e.playState();

	return {
		sessionId: String(item?.id ?? ''),
		playbackState: isPlaybackState(state)
			? PLAYBACK_STATE[state]
			: 'idle',
		positionMs: toMilliseconds(e.time()),
		durationMs: toMilliseconds(e.duration()),
		itemId: String(item?.id ?? ''),
		itemKind: itemKind(item),
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
		volume: toUnitVolume(e.volume()),
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

	await e.volume(clampVolume(target));
}

const NO_CONTENT = Symbol('no content');
const V1_PREFIX = /^\/v1(?=\/)/;

type Command = (e: ControlEngine, body: Body) => Promise<void> | void;
type Answer = ResponseBody | typeof NO_CONTENT;
type Handler = (e: ControlEngine, body: Body) => Promise<Answer> | Answer;

// A command answers 204 once the player took it.
function command(fn: Command): Handler {
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

const StopRoute = 'POST /session/transport/stop';

export function isStopRequest(req: ControlRequest): boolean {
	return `${req.method.toUpperCase()} ${req.path.replace(V1_PREFIX, '')}` === StopRoute;
}

function isRoute(key: string): key is keyof typeof ROUTES {
	return Object.hasOwn(ROUTES, key);
}

export async function answerControl(
	req: ControlRequest,
	engine: ControlEngine | null,
): Promise<ControlResponse> {
	const path = req.path.replace(V1_PREFIX, '');
	const method = req.method.toUpperCase();

	if (method === 'GET' && path === '/ping') {
		return {
			id: req.id,
			status: 200,
			body: { ok: true },
		};
	}

	const key = `${method} ${path}`;

	if (!isRoute(key)) {
		return {
			id: req.id,
			status: 404,
			body: null,
		};
	}

	if (!engine) {
		return {
			id: req.id,
			// Stop is an idempotent teardown (SessionRoutes.kt:96-103); the rest need a session.
			status: key === StopRoute
				? 204
				: 412,
			body: null,
		};
	}

	try {
		const result = await ROUTES[key](engine, req.body ?? {});

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
	if (typeof data !== 'object' || data === null || !('control' in data))
		return false;

	const { control } = data;

	return typeof control === 'object' && control !== null &&
		'id' in control && typeof control.id === 'number' &&
		'method' in control && typeof control.method === 'string' &&
		'path' in control && typeof control.path === 'string';
}
