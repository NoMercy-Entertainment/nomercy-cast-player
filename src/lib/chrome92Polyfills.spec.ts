// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { afterEach, describe, expect, it } from 'vitest';
import { installChrome92Polyfills, POLYFILLED } from './chrome92Polyfills';

const native = Object.hasOwn;
const nativeAt = Array.prototype.at;
const nativeReplaceAll = String.prototype.replaceAll;
const nativeReplaceChildren = Element.prototype.replaceChildren;
const nativeFragmentReplaceChildren = DocumentFragment.prototype.replaceChildren;

// The test runner itself calls Object.hasOwn, so each case puts it back at once.
afterEach(() => {
	Object.defineProperty(Object, 'hasOwn', {
		value: native,
		configurable: true,
		writable: true,
	});

	Object.defineProperty(Array.prototype, 'at', {
		value: nativeAt,
		configurable: true,
		writable: true,
	});

	Object.defineProperty(String.prototype, 'replaceAll', {
		value: nativeReplaceAll,
		configurable: true,
		writable: true,
	});

	Object.defineProperty(Element.prototype, 'replaceChildren', {
		value: nativeReplaceChildren,
		configurable: true,
		writable: true,
	});

	Object.defineProperty(DocumentFragment.prototype, 'replaceChildren', {
		value: nativeFragmentReplaceChildren,
		configurable: true,
		writable: true,
	});
});

describe('the Chrome 80 polyfills', () => {
	it('adds DOM replacement for the TV UI on Chrome 80', () => {
		Reflect.deleteProperty(Element.prototype, 'replaceChildren');
		Reflect.deleteProperty(DocumentFragment.prototype, 'replaceChildren');
		installChrome92Polyfills();
		const parent = document.createElement('div');
		const child = document.createElement('span');

		parent.append(child);
		parent.replaceChildren('before', child, 'after');
		expect(parent.textContent).toBe('beforeafter');
		expect(parent.childNodes[1]).toBe(child);
		const fragment = document.createDocumentFragment();

		fragment.replaceChildren(child, 'fragment');
		parent.replaceChildren(fragment);
		expect(parent.textContent).toBe('fragment');
		parent.replaceChildren();
		expect(parent.childNodes).toHaveLength(0);
	});

	it('rejects an ancestor without destroying the existing tree', () => {
		Reflect.deleteProperty(Element.prototype, 'replaceChildren');
		installChrome92Polyfills();
		const parent = document.createElement('div');
		const child = document.createElement('span');

		parent.append(child);
		expect(() => child.replaceChildren(parent)).toThrow(DOMException);
		expect(parent.firstChild).toBe(child);
		expect(() => parent.replaceChildren(parent)).toThrow(DOMException);
		expect(parent.firstChild).toBe(child);
	});

	it('adds the array indexing and chapter string APIs absent in Chrome 80', () => {
		Reflect.deleteProperty(Array.prototype, 'at');
		Reflect.deleteProperty(String.prototype, 'replaceAll');
		installChrome92Polyfills();
		expect([1, 2, 3].at(-1)).toBe(3);
		expect('a\rb\rc'.replaceAll('\r', '')).toBe('abc');
	});

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
		expect(Array.prototype.at).toBe(nativeAt);
		expect(String.prototype.replaceAll).toBe(nativeReplaceAll);
		expect(Element.prototype.replaceChildren).toBe(nativeReplaceChildren);
		expect(DocumentFragment.prototype.replaceChildren).toBe(nativeFragmentReplaceChildren);
	});

	it('preserves relative indexing and replacement-string semantics', () => {
		Reflect.deleteProperty(Array.prototype, 'at');
		Reflect.deleteProperty(String.prototype, 'replaceAll');
		installChrome92Polyfills();
		expect([1, 2].at(-1.9)).toBe(2);
		expect([1, 2].at(Number.POSITIVE_INFINITY)).toBeUndefined();
		expect(Array.prototype.at.call({ 0: 'a', length: 1 }, 0)).toBe('a');
		expect('ab'.replaceAll('', '-')).toBe('-a-b-');
		expect('aba'.replaceAll('a', '$&$&')).toBe('aabaa');

		expect('aba'.replaceAll(/a/g, (value, index) =>
			`${value}${index}`)).toBe('a0ba2');

		// eslint-disable-next-line regexp/no-missing-g-flag -- this verifies the required rejection
		expect(() => 'aba'.replaceAll(/a/, 'x')).toThrow(TypeError);
	});

	it('lists exactly the APIs it installs, for the build check', () => {
		expect([...POLYFILLED]).toEqual([
			'Object.hasOwn',
			'Array.prototype.at',
			'String.prototype.replaceAll',
			'ParentNode.replaceChildren',
		]);
	});
});
