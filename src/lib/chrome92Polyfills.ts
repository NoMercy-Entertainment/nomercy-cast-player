// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import arrayAt from 'core-js-pure/es/array/virtual/at';
import replaceAll from 'core-js-pure/es/string/virtual/replace-all';

// Chrome 80 is the receiver's browser floor. Each name here is a newer built-in the bundle uses,
// and scripts/check-cast-css.mjs fails the build for any such built-in missing from this list.
export const POLYFILLED = [
	'Object.hasOwn',
	'Array.prototype.at',
	'String.prototype.replaceAll',
	'ParentNode.replaceChildren',
] as const;

function hasOwn(target: object, key: PropertyKey): boolean {
	// eslint-disable-next-line e18e/prefer-object-has-own -- this is the Object.hasOwn polyfill
	return Object.prototype.hasOwnProperty.call(target, key);
}

function containsParent(node: Node | string, parent: Node): boolean {
	if (typeof node === 'string')
		return false;

	try {
		// Native brand checking also accepts Nodes from another window.
		return Node.prototype.contains.call(node, parent);
	} catch {
		// append() below performs native string conversion for non-Node arguments.
		return false;
	}
}

function replaceChildren(this: Element | DocumentFragment, ...nodes: (Node | string)[]): void {
	for (const node of nodes) {
		if (containsParent(node, this))
			throw new DOMException('A parent cannot replace its children with an ancestor.', 'HierarchyRequestError');
	}

	// Native append validates node types and converts strings before the old children are removed.
	const fragment = this.ownerDocument.createDocumentFragment();

	fragment.append(...nodes);
	this.textContent = '';
	this.appendChild(fragment);
}

function installDomReplacement(): void {
	if (typeof Element === 'undefined' || typeof DocumentFragment === 'undefined') return;

	for (const prototype of [Element.prototype, DocumentFragment.prototype]) {
		if (typeof prototype.replaceChildren === 'function') continue;

		Object.defineProperty(prototype, 'replaceChildren', {
			value: replaceChildren,
			configurable: true,
			writable: true,
		});
	}
}

export function installChrome92Polyfills(): void {
	installDomReplacement();

	if (typeof Object.hasOwn !== 'function') {
		Object.defineProperty(Object, 'hasOwn', {
			value: hasOwn,
			configurable: true,
			writable: true,
		});
	}

	if (typeof Array.prototype.at !== 'function') {
		Object.defineProperty(Array.prototype, 'at', {
			value: arrayAt,
			configurable: true,
			writable: true,
		});
	}

	if (typeof String.prototype.replaceAll !== 'function') {
		Object.defineProperty(String.prototype, 'replaceAll', {
			value: replaceAll,
			configurable: true,
			writable: true,
		});
	}
}

installChrome92Polyfills();
