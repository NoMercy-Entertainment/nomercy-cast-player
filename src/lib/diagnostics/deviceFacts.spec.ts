import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectDeviceFacts } from './deviceFacts';
import { renderDiagnosticsReport } from './report';

const CAST_UA = 'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) '
	+ 'Chrome/120.0.0.0 Safari/537.36 CrKey/1.56.500000';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('collectDeviceFacts', () => {
	it('produces a valid report on a device without performance.memory', () => {
		vi.stubGlobal('navigator', { userAgent: CAST_UA });
		vi.stubGlobal('performance', { now: () => 0 });

		const facts = collectDeviceFacts();

		expect(facts.heapCeilingMb).toBe(0);
		expect(facts.heapUsedMb).toBe(0);
		expect(facts.abi).toBe('armv7l');
		expect(facts.platformVersion).toBe('120.0.0.0');
		expect(facts.model).toBe('CrKey 1.56.500000');

		const body = renderDiagnosticsReport(facts, [], 0);

		expect(body).toContain('heap unavailable, threads unavailable');
		expect(body).toContain('device CrKey 1.56.500000 armv7l cast 120.0.0.0');
		expect(body).toContain('events 0 held, 0 dropped');
	});

	it('reports heap figures when the engine exposes them', () => {
		vi.stubGlobal('navigator', { userAgent: CAST_UA });
		vi.stubGlobal('performance', {
			now: () => 0,
			memory: {
				jsHeapSizeLimit: 384 * 1024 * 1024,
				totalJSHeapSize: 256 * 1024 * 1024,
				usedJSHeapSize: 210 * 1024 * 1024,
			},
		});

		const facts = collectDeviceFacts();

		expect(facts.heapCeilingMb).toBe(384);
		expect(facts.heapUsedMb).toBe(210);
		expect(renderDiagnosticsReport(facts, [], 0)).toContain('heap 210MB of 384MB');
	});
});
