// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const CSS_ID = /\.css(?:\?|$)|&lang\.css/;
const DIMENSIONS = new Set(['width', 'height']);
const SIDES = ['top', 'right', 'bottom', 'left'];
const FLEX_WRAP = ['flex', 'wrap'].join('-');
const FLEX_FLOW = ['flex', 'flow'].join('-');
const PHYSICAL_MARGIN = /^margin-(?:top|right|bottom|left)$/;

function metadata(decl) {
	if (decl.prop === 'aspect-ratio')
		decl.cloneAfter({ prop: '--cast-aspect-ratio' });
	if (DIMENSIONS.has(decl.prop))
		decl.cloneAfter({ prop: `--cast-css-${decl.prop}` });
	if (decl.prop === 'margin') {
		const values = postcss.list.space(decl.value);
		const sides = [values[0], values[1] ?? values[0], values[2] ?? values[0], values[3] ?? values[1] ?? values[0]];
		SIDES.forEach((side, index) => decl.cloneAfter({ prop: `--cast-margin-${side}`, value: sides[index] }));
	}
	else if (PHYSICAL_MARGIN.test(decl.prop)) {
		decl.cloneAfter({ prop: `--cast-${decl.prop}` });
	}
	if ((decl.prop === FLEX_WRAP && decl.value !== 'nowrap') || decl.prop === FLEX_FLOW)
		throw decl.error('Chrome 80 fallback covers non-wrapping flex layouts; add browser-proven wrapping support before using wrapping or flow shorthands.');
}

function fallbackSelector(selector, from, to) {
	return selectorParser((root) => {
		root.walkPseudos((pseudo) => {
			if (pseudo.value === from)
				pseudo.value = to;
		});
	}).processSync(selector);
}

export function transformCastLayoutCss(css) {
	const root = postcss.parse(css);
	root.walkDecls(metadata);
	const originals = [];
	root.walkRules(rule => originals.push(rule));
	for (const rule of originals) {
		for (const [from, to, condition] of [
			[':where', ':is', 'not selector(:where(*))'],
			[':focus-visible', ':focus', 'not selector(:focus-visible)'],
		]) {
			if (!rule.selector.includes(from))
				continue;
			const fallback = postcss.atRule({ name: 'supports', params: condition });
			fallback.append(rule.clone({ selector: fallbackSelector(rule.selector, from, to) }));
			rule.after(fallback);
		}
	}
	return root.toString();
}

export function castLayoutCss() {
	return {
		name: 'cast-chrome80-layout',
		enforce: 'pre',
		transform(code, id) {
			if (!CSS_ID.test(id))
				return undefined;
			return { code: transformCastLayoutCss(code), map: null };
		},
	};
}
