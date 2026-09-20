import { describe, expect, it } from 'vitest';
import { buildDiagnosticsReport } from './payload';
import type { DeviceFacts } from './deviceFacts';
import type { DiagnosticsEntry } from './events';

const FACTS: DeviceFacts = {
	appVersion: '1.0.0-alpha.0',
	model: 'Chromecast Ultra',
	abi: 'armv7l',
	platformVersion: '120.0.0.0',
	heapCeilingMb: 384,
	heapUsedMb: 210,
	threads: 0,
};

const ENTRIES: DiagnosticsEntry[] = [
	{ atMs: 1000, category: 'Playback', code: 'SourceRequested', a: 0, b: 0, c: 0 },
	{ atMs: 1250, category: 'Playback', code: 'SourceFailed', a: 404, b: 0, c: 0 },
];

// Every key the contract names, spelled the way nomercy-tv reads it.
const REQUIRED_FIELDS = [
	'device_id',
	'kind',
	'app_version',
	'model',
	'abi',
	'platform_version',
	'heap_ceiling_mb',
	'heap_used_mb',
	'threads',
	'events_held',
	'events_dropped',
	'body',
];

describe('buildDiagnosticsReport', () => {
	it('carries every field the server requires', () => {
		const payload = buildDiagnosticsReport({
			deviceId: 'cast-abc',
			kind: 'manual',
			facts: FACTS,
			entries: ENTRIES,
			recorded: 2100,
		});

		expect(Object.keys(payload).sort()).toEqual([...REQUIRED_FIELDS].sort());
		expect(payload.device_id).toBe('cast-abc');
		expect(payload.kind).toBe('manual');
		expect(payload.app_version).toBe('1.0.0-alpha.0');
		expect(payload.platform_version).toBe('120.0.0.0');
		expect(payload.heap_ceiling_mb).toBe(384);
		expect(payload.events_held).toBe(2);
		expect(payload.events_dropped).toBe(2098);
		expect(payload.body).toContain('+250ms Playback SourceFailed 404');
	});

	it('reports missing device figures as unavailable rather than zero', () => {
		const payload = buildDiagnosticsReport({
			deviceId: 'cast-abc',
			kind: 'manual',
			facts: { ...FACTS, heapCeilingMb: 0, heapUsedMb: 0 },
			entries: ENTRIES,
			recorded: 2,
		});

		expect(payload.body).toContain('heap unavailable, threads unavailable');
		expect(payload.body).not.toContain('0MB');
	});
});
