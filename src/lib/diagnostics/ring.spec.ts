import { describe, expect, it } from 'vitest';
import { DiagnosticsRing } from './ring';
import { DiagnosticsCategory, DiagnosticsCode } from './events';

function fixedClock(): () => number {
	let now = 0;
	return () => {
		now += 10;
		return now;
	};
}

describe('diagnosticsRing', () => {
	it('keeps the newest events and drops the oldest when full', () => {
		const ring = new DiagnosticsRing(4, fixedClock());

		for (let i = 1; i <= 6; i += 1)
			ring.record(DiagnosticsCategory.Playback, DiagnosticsCode.Buffering, i);

		const entries = ring.snapshot();

		expect(entries).toHaveLength(4);
		expect(entries.map(entry => entry.a)).toEqual([3, 4, 5, 6]);
		expect(ring.recorded()).toBe(6);
	});

	it('reads a snapshot oldest first', () => {
		const ring = new DiagnosticsRing(8, fixedClock());

		ring.record(DiagnosticsCategory.Network, DiagnosticsCode.SocketOpened, 1);
		ring.record(DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStarted, 2);
		ring.record(DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackEnded, 3);

		const entries = ring.snapshot();

		expect(entries.map(entry => entry.code)).toEqual([
			'SocketOpened',
			'PlaybackStarted',
			'PlaybackEnded',
		]);
		expect(entries.map(entry => entry.atMs)).toEqual([10, 20, 30]);
		expect(entries[0].category).toBe('Network');
	});
});
