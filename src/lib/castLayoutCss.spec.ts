// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { transformCastLayoutCss } from '../../scripts/castLayoutCss.mjs';

describe('chrome 80 layout metadata and selectors', () => {
	it('keeps native declarations and describes explicit dimensions and margins', () => {
		const css = transformCastLayoutCss('.card{width:100%;height:auto;aspect-ratio:2/3;margin:1px 2px 3px 4px}');

		expect(css).toContain('aspect-ratio:2/3');
		expect(css).toContain('--cast-aspect-ratio:2/3');
		expect(css).toContain('--cast-css-height:auto');
		expect(css).toContain('--cast-margin-left:4px');
	});

	it('adds selector fallbacks only under feature checks', () => {
		const css = transformCastLayoutCss(':where(.icon){display:block}.button:focus-visible{outline:2px solid red}');

		expect(css).toContain('not selector(:where(*))');
		expect(css).toContain(':is(.icon)');
		expect(css).toContain('not selector(:focus-visible)');
		expect(css).toContain('.button:focus{');
	});

	it('rejects future wrapping layouts instead of claiming unsupported spacing', () => {
		const property = ['flex', 'wrap'].join('-');

		expect(() => transformCastLayoutCss(`.row{display:flex;gap:8px;${property}:wrap}`)).toThrow('non-wrapping');
	});
});
