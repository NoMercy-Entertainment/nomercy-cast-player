import { describe, expect, it } from 'vitest';

import type { CurrentTrackSnapshot } from '@/stores/playbackStore';

import { formatTime, progressPercent, totalLabel } from './transport';

function track(over: Partial<CurrentTrackSnapshot> = {}): CurrentTrackSnapshot {
	return {
		id: 'a',
		name: 'Track',
		duration_ms: 240_000,
		...over,
	};
}

describe('the music transport', () => {
	it('reads a track as minutes and seconds', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(65_000)).toBe('1:05');
		expect(totalLabel(track())).toBe('4:00');
	});

	it('reads a live stream as Live, not as a zero length track', () => {
		expect(totalLabel(track({ live: true, duration_ms: 0 }))).toBe('Live');
	});

	// A station that reports a length is still a station: the number is what
	// the server had, not an end the listener is travelling towards.
	it('draws no progress for a live stream, whatever length it reports', () => {
		expect(progressPercent(track({ live: true, duration_ms: 0 }), 900_000)).toBe(0);
		expect(progressPercent(track({ live: true, duration_ms: 240_000 }), 120_000)).toBe(0);
	});

	it('draws progress for a track that has an end', () => {
		expect(progressPercent(track(), 120_000)).toBe(50);
	});

	it('never draws past the end', () => {
		expect(progressPercent(track(), 999_000)).toBe(100);
	});

	it('draws nothing when nothing is playing', () => {
		expect(totalLabel(null)).toBe('0:00');
		expect(progressPercent(null, 5_000)).toBe(0);
	});
});
