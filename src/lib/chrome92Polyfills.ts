// The Cast device runs Chrome 92. Each name here is a newer built-in the bundle uses,
// and scripts/check-cast-css.mjs fails the build for any such built-in missing from this list.
export const POLYFILLED = ['Object.hasOwn'] as const;

function hasOwn(target: object, key: PropertyKey): boolean {
	// eslint-disable-next-line e18e/prefer-object-has-own -- this is the Object.hasOwn polyfill
	return Object.prototype.hasOwnProperty.call(target, key);
}

export function installChrome92Polyfills(): void {
	// Chrome 93+. The player library calls it while it registers a plugin.
	if (typeof Object.hasOwn !== 'function') {
		Object.defineProperty(Object, 'hasOwn', {
			value: hasOwn,
			configurable: true,
			writable: true,
		});
	}
}

installChrome92Polyfills();
