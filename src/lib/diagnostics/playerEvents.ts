import type { DiagnosticsCategoryValue, DiagnosticsCodeValue } from './events';
import { DiagnosticsCategory, DiagnosticsCode } from './events';
import { allowDiagnosticsWords } from './censor';
import { recordDiagnostic } from './sink';

// The whole event set the kit emits — core, plus the video and music additions
// — rather than a shortlist somebody once found interesting. Read from
// nomercy-player-core/dist/types/events.d.ts, nomercy-video-player and
// nomercy-music-player. See
// specs/nomercy-app-kmp/diagnostics-capture-everything.md.
export const ALL_PLAYER_EVENTS: readonly string[] = [
	'beforeSetup',
	'setupStart',
	'configResolved',
	'pluginsRegistering',
	'pluginsRegistered',
	'streamsReady',
	'authReady',
	'playlistResolving',
	'playlistReady',
	'playlistError',
	'mediaReady',
	'ready',
	'setupStartError',
	'configResolvedError',
	'pluginsRegisteringError',
	'pluginsRegisteredError',
	'streamsReadyError',
	'authReadyError',
	'playlistResolveError',
	'mediaReadyError',
	'beforePlay',
	'firstFrame',
	'playing',
	'playPrevented',
	'beforePause',
	'pausePrevented',
	'beforeStop',
	'stopPrevented',
	'beforeNext',
	'nextPrevented',
	'beforePrevious',
	'previousPrevented',
	'beforeSeek',
	'seekPrevented',
	'beforeLoad',
	'loadPrevented',
	'beforeMutation',
	'mutationPrevented',
	'phase',
	'play',
	'pause',
	'stop',
	'next',
	'previous',
	'ended',
	'seek',
	'seeked',
	'progress',
	'time',
	'dispose',
	'beforeDispose',
	'disposePrevented',
	'language',
	'beforeLanguage',
	'languagePrevented',
	'volume',
	'beforeVolume',
	'volumePrevented',
	'mute',
	'beforeMute',
	'mutePrevented',
	'repeat',
	'beforeRepeat',
	'repeatPrevented',
	'shuffle',
	'beforeShuffle',
	'shufflePrevented',
	'playbackRate',
	'beforePlaybackRate',
	'playbackRatePrevented',
	'fatal',
	'error',
	'warning',
	'info',
	'item',
	'song',
	'queue',
	'backlog',
	'itemEndingSoon',
	'trackEndingSoon',
	'duration',
	'subtitleCue',
	'subtitleStyle',
	'subtitle',
	'beforeSubtitle',
	'subtitlePrevented',
	'subtitles',
	'audioTrack',
	'beforeAudioTrack',
	'audioTrackPrevented',
	'chapter',
	'chapters',
	'castState',
	'beforeTransfer',
	'transferPrevented',
	'qualityState',
	'audioTrackState',
	'activity',
	'preloadStart',
	'preloadProgress',
	'preloadComplete',
	'preloadError',
	'transitionStart',
	'transitionProgress',
	'transitionComplete',
	'transitionCancelled',
	'pip',
	'theater',
	'fullscreen',
	'aspectRatio',
	'videoRect',
	'segmentBoundary',
	'waiting',
	'canplay',
	'stalled',
	'levels',
	'audioTracks',
	'back',
	'close',
	'cast',
	'beforeCrossfade',
	'crossfadePrevented',
	'crossfadeStart',
	'crossfadeComplete',
];

// `time` is the per-frame playback clock, not an event: at sixty a second it
// would empty a 2000-slot ring in half a minute and bury everything else.
// `progress` carries the same position, throttled, and is recorded.
const EXCLUDED_EVENTS = new Set(['time']);

// Where the kit's name already has a code of its own, the code wins so a
// report keeps reading the way it always has. Everything else lands as
// `PlayerEvent` carrying its kit name, which is what makes a new kit event
// visible without anybody editing this table.
const CODED_EVENTS: Readonly<Record<string, [DiagnosticsCategoryValue, DiagnosticsCodeValue]>> = {
	playlistResolving: [DiagnosticsCategory.Network, DiagnosticsCode.SourceRequested],
	beforeLoad: [DiagnosticsCategory.Network, DiagnosticsCode.SourceRequested],
	playlistReady: [DiagnosticsCategory.Network, DiagnosticsCode.SourceResolved],
	playlistError: [DiagnosticsCategory.Network, DiagnosticsCode.SourceFailed],
	playlistResolveError: [DiagnosticsCategory.Network, DiagnosticsCode.SourceFailed],
	ready: [DiagnosticsCategory.Playback, DiagnosticsCode.Prepared],
	mediaReady: [DiagnosticsCategory.Playback, DiagnosticsCode.Prepared],
	waiting: [DiagnosticsCategory.Playback, DiagnosticsCode.Buffering],
	playing: [DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStarted],
	stalled: [DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStalled],
	ended: [DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackEnded],
	error: [DiagnosticsCategory.Playback, DiagnosticsCode.PlayerError],
	fatal: [DiagnosticsCategory.Playback, DiagnosticsCode.PlayerError],
	warning: [DiagnosticsCategory.Playback, DiagnosticsCode.WarningLogged],
	info: [DiagnosticsCategory.Playback, DiagnosticsCode.WarningLogged],
	playPrevented: [DiagnosticsCategory.Playback, DiagnosticsCode.StartWithheld],
	play: [DiagnosticsCategory.Input, DiagnosticsCode.PlayPressed],
	pause: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	stop: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	next: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	previous: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	seek: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	volume: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	mute: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	repeat: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	shuffle: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	playbackRate: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	subtitle: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	audioTrack: [DiagnosticsCategory.Input, DiagnosticsCode.InputAction],
	castState: [DiagnosticsCategory.Lifecycle, DiagnosticsCode.PlayerEvent],
};

/** The minimum an engine has to offer for its events to be recorded. */
export interface DiagnosticsEngine {
	on: (event: string, handler: (...args: unknown[]) => void) => void;
	off: (event: string, handler?: (...args: unknown[]) => void) => void;
}

const WORD_KEYS = ['reason', 'to', 'method', 'lang', 'code', 'name'] as const;

/** The one word that explains the line, where the payload carries one. */
export function payloadWord(payload: unknown): string | undefined {
	const record = payload as Record<string, unknown> | null | undefined;
	if (!record || typeof record !== 'object')
		return undefined;

	for (const key of WORD_KEYS) {
		const value = record[key];
		if (typeof value === 'string' && value.length > 0)
			return value;
	}

	return undefined;
}

/**
 * One number worth keeping out of whatever shape the event carried. Every kit
 * payload that means something numeric — a seek target, a volume, an error id,
 * a quality level — lands in field `b` without a per-event unpacker.
 */
export function numericField(payload: unknown): number {
	if (typeof payload === 'number' && Number.isFinite(payload))
		return Math.round(payload);

	if (typeof payload === 'boolean')
		return payload ? 1 : 0;

	const record = payload as Record<string, unknown> | null | undefined;
	if (!record || typeof record !== 'object')
		return 0;

	const nested = (record.error ?? record.data) as Record<string, unknown> | undefined;
	const candidates = [record.time, record.id, record.level, record.percentage, record.length, nested?.id, nested?.time];

	for (const candidate of candidates) {
		if (typeof candidate === 'number' && Number.isFinite(candidate))
			return Math.round(candidate);
	}

	return 0;
}

/**
 * Subscribes to every event the engine emits, so a seam that exists is
 * recorded rather than argued about. Every subscription is pushed onto
 * `unsubs` so a detach still tears all of them down. Returns how many events
 * were subscribed, which is what a test asserts against `ALL_PLAYER_EVENTS`.
 */
export function attachEngineDiagnostics(
	engine: DiagnosticsEngine,
	mediaLabel: () => string | undefined,
	unsubs: Array<() => void>,
): number {
	allowDiagnosticsWords(ALL_PLAYER_EVENTS);

	let subscribed = 0;

	for (const event of ALL_PLAYER_EVENTS) {
		if (EXCLUDED_EVENTS.has(event))
			continue;

		subscribed += 1;

		const handler = (...args: unknown[]): void => {
			const payload = args[0];
			const coded = CODED_EVENTS[event];
			const category = coded ? coded[0] : DiagnosticsCategory.Playback;
			const code = coded ? coded[1] : DiagnosticsCode.PlayerEvent;
			const parts = [event, payloadWord(payload), mediaLabel()];
			const label = parts.filter(part => part !== undefined).join(' ');

			recordDiagnostic(category, code, 0, numericField(payload), 0, label);
		};

		engine.on(event, handler);
		unsubs.push(() => engine.off(event, handler));
	}

	return subscribed;
}
