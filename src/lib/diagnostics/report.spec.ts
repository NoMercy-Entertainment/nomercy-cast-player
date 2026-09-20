import type { DiagnosticsEntry } from './events';
import type { DeviceFacts } from './deviceFacts';
import { describe, expect, it } from 'vitest';
import { renderDiagnosticsReport } from './report';

// A report of bare numbers cannot say which screen or title an event belongs
// to — the uselessness this file exists to keep out.

const facts: DeviceFacts = {
	appVersion: '1.0.0-alpha.0',
	model: 'Chromecast',
	abi: 'web',
	platformVersion: '1.56',
	heapCeilingMb: 384,
	heapUsedMb: 120,
	threads: 4,
};

describe('renderDiagnosticsReport', () => {
	it('puts the name straight after the code', () => {
		const entries: DiagnosticsEntry[] = [
			{ atMs: 10, category: 'Lifecycle', code: 'ScreenOpened', a: 0, b: 0, c: 0, label: 'watch-movie 672' },
		];

		const body = renderDiagnosticsReport(facts, entries, 0);

		expect(body).toContain('+0ms Lifecycle ScreenOpened watch-movie 672');
	});

	it('an event with no name renders with nothing in its place', () => {
		const entries: DiagnosticsEntry[] = [
			{ atMs: 10, category: 'Playback', code: 'PlaybackStarted', a: 0, b: 0, c: 0 },
		];

		const body = renderDiagnosticsReport(facts, entries, 0);

		expect(body).toContain('+0ms Playback PlaybackStarted');
		expect(body).not.toMatch(/PlaybackStarted\s+undefined/);
	});

	it('a name and numeric fields both render on the same line', () => {
		const entries: DiagnosticsEntry[] = [
			{ atMs: 10, category: 'Network', code: 'SocketFailed', a: 2, b: 0, c: 0, label: 'musicHub' },
		];

		const body = renderDiagnosticsReport(facts, entries, 0);

		expect(body).toContain('+0ms Network SocketFailed musicHub 2');
	});
});
