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

	it('an event carries its name', () => {
		const ring = new DiagnosticsRing(4, fixedClock());

		ring.record(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, 'home');

		expect(ring.snapshot()[0].label).toBe('home');
	});

	it('an event without a name has none', () => {
		const ring = new DiagnosticsRing(4, fixedClock());

		ring.record(DiagnosticsCategory.Playback, DiagnosticsCode.PlaybackStarted);

		expect(ring.snapshot()[0].label).toBeUndefined();
	});

	it('the same name twice is stored once', () => {
		const ring = new DiagnosticsRing(8, fixedClock());

		ring.record(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, 'home');
		ring.record(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenClosed, 0, 0, 0, 'home');

		expect(ring.labelCount()).toBe(1);
		expect(ring.snapshot().map(entry => entry.label)).toEqual(['home', 'home']);
	});

	it('the name survives the ring wrapping', () => {
		const ring = new DiagnosticsRing(2, fixedClock());

		ring.record(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, 'home');
		ring.record(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, 'library');
		ring.record(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, 'watch');

		expect(ring.snapshot().map(entry => entry.label)).toEqual(['library', 'watch']);
	});

	it('a 257th distinct name is dropped and the event still records', () => {
		const ring = new DiagnosticsRing(300, fixedClock());

		for (let i = 0; i < 257; i += 1)
			ring.record(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, `screen${i}`);

		const entries = ring.snapshot();

		expect(entries).toHaveLength(257);
		expect(ring.labelCount()).toBe(256);
		expect(entries[255].label).toBe('screen255');
		expect(entries[256].label).toBeUndefined();
	});
});
