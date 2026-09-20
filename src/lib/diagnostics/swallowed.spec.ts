import { beforeEach, describe, expect, it } from 'vitest';

import { recordSwallowed, swallowedClassName } from './swallowed';
import { diagnosticsRing } from './sink';

function onlyCaught() {
	return diagnosticsRing.snapshot().filter(entry => entry.code === 'ErrorCaught');
}

describe('a swallowed failure is recorded without its message', () => {
	beforeEach(() => {
		diagnosticsRing.clear();
	});

	it('records the class name of what was thrown', () => {
		recordSwallowed('readCastModel', new RangeError('nope'));

		expect(onlyCaught()[0].label).toContain('RangeError');
	});

	it('keeps a plain Error recognisable rather than letting the censor drop it', () => {
		recordSwallowed('readCastModel', new Error('nope'));

		expect(onlyCaught()[0].label).toContain('Error');
	});

	it('never records the error message', () => {
		// A word the censor keeps, so the test fails if the message travels at
		// all rather than passing because the censor happened to drop it.
		recordSwallowed('readCastModel', new TypeError('unlockable'));

		expect(onlyCaught()[0].label).not.toContain('unlockable');
	});

	it('records the site label so a reader knows where it happened', () => {
		recordSwallowed('applyRemoteFrame', new TypeError('nope'));

		expect(onlyCaught()[0].label).toContain('applyRemoteFrame');
	});

	it('names a thrown value that is not an error without inventing a class', () => {
		expect(swallowedClassName('a secret string')).toBe('nonError');
		expect(swallowedClassName(undefined)).toBe('nonError');
	});
});
