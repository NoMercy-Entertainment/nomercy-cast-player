import { afterEach, describe, expect, it } from 'vitest';
import { installChrome92Polyfills, POLYFILLED } from './chrome92Polyfills';

const native = Object.hasOwn;

// The test runner itself calls Object.hasOwn, so each case puts it back at once.
afterEach(() => {
	Object.defineProperty(Object, 'hasOwn', { value: native, configurable: true, writable: true });
});

describe('the Chrome 92 polyfills', () => {
	it('adds Object.hasOwn, which the Cast device (Chrome 92) lacks', () => {
		Reflect.deleteProperty(Object, 'hasOwn');
		expect(Reflect.get(Object, 'hasOwn')).toBeUndefined();

		installChrome92Polyfills();

		const hasOwn = Reflect.get(Object, 'hasOwn') as typeof Object.hasOwn;

		expect(hasOwn({ a: 1 }, 'a')).toBe(true);
		expect(hasOwn({ a: 1 }, 'toString')).toBe(false);
		expect(hasOwn(Object.create({ inherited: 1 }), 'inherited')).toBe(false);
		expect(() => hasOwn(null as never, 'a')).toThrow(TypeError);
	});

	it('leaves a native Object.hasOwn alone', () => {
		installChrome92Polyfills();

		expect(Object.hasOwn).toBe(native);
	});

	it('lists exactly the APIs it installs, for the build check', () => {
		expect([...POLYFILLED]).toEqual(['Object.hasOwn']);
	});
});
