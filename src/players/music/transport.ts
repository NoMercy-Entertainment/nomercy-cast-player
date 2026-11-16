import { formatSeconds } from '@nomercy-entertainment/nomercy-player-core';
import i18next from '@/i18n/i18next';
import type { CurrentTrackSnapshot } from '@/stores/playbackStore';

/**
 * What the right-hand side of the bar reads.
 *
 * A live stream has no end, and a plugin's station arrived with a duration of
 * zero: the bar read "0:00" beside a clock that kept counting up, which reads
 * as a broken player rather than as radio.
 */
export function totalLabel(track: CurrentTrackSnapshot | null): string {
	if (track?.live)
		return i18next.t('music.player.live');

	return formatSeconds(Math.round((track?.duration_ms ?? 0) / 1000));
}

/** A stream with no end has no progress to draw, however long it has been playing. */
export function progressPercent(track: CurrentTrackSnapshot | null, timeMs: number): number {
	const total = track?.duration_ms ?? 0;

	if (track?.live || !total)
		return 0;

	return Math.min(100, (timeMs / total) * 100);
}
