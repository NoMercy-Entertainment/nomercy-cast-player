import { beforeEach, describe, expect, it, vi } from 'vitest';

import { caughtLabel, installDiagnosticsConsoleTap } from './consoleTap';
import { diagnosticsRing } from './sink';

describe('the console tap records what the receiver swallows', () => {
	beforeEach(() => {
		diagnosticsRing.clear();
	});

	it('records an error the receiver caught and logged instead of throwing', () => {
		const fake = { error: vi.fn(), warn: vi.fn() } as unknown as Console;
		installDiagnosticsConsoleTap(fake);

		fake.error('[cast] handshake failed', new TypeError('bad'));

		const caught = diagnosticsRing.snapshot().filter(entry => entry.code === 'ErrorCaught');
		expect(caught).toHaveLength(1);
		expect(caught[0].label).toBe('TypeError');
	});

	it('records a warning the receiver swallowed', () => {
		const fake = { error: vi.fn(), warn: vi.fn() } as unknown as Console;
		installDiagnosticsConsoleTap(fake);

		fake.warn('[cast] navigate message carried no token');

		expect(diagnosticsRing.snapshot().filter(entry => entry.code === 'WarningLogged')).toHaveLength(1);
	});

	it('passes the call through to the real console', () => {
		const spy = vi.fn();
		const fake = { error: spy, warn: vi.fn() } as unknown as Console;
		installDiagnosticsConsoleTap(fake);

		fake.error('still logged');

		expect(spy).toHaveBeenCalledWith('still logged');
	});

	it('keeps the error class name out of the message prose', () => {
		expect(caughtLabel([new RangeError('The Matrix could not be loaded')])).toBe('RangeError');
	});
});
