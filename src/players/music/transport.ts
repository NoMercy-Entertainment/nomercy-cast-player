import type { CurrentTrackSnapshot } from '@/stores/playbackStore';

export function formatTime(ms: number): string {
	const total: number = Math.max(0, Math.round(ms / 1000));
	const minutes: number = Math.floor(total / 60);
	const seconds: number = total % 60;

	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * What the right-hand side of the bar reads.
 *
 * A live stream has no end, and a plugin's station arrived with a duration of
 * zero: the bar read "0:00" beside a clock that kept counting up, which reads
 * as a broken player rather than as radio.
 */
export function totalLabel(track: CurrentTrackSnapshot | null): string {
	if (track?.live)
		return 'Live';

	return formatTime(track?.duration_ms ?? 0);
}

/** A stream with no end has no progress to draw, however long it has been playing. */
export function progressPercent(track: CurrentTrackSnapshot | null, timeMs: number): number {
	const total: number = track?.duration_ms ?? 0;

	if (track?.live || !total)
		return 0;

	return Math.min(100, (timeMs / total) * 100);
}
