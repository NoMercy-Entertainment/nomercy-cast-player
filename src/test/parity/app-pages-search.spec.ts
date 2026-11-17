import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const S = 'views/search/';
const source = (file: string): string => readFileSync(resolve(__dirname, '../..', S, file), 'utf8');

describe('row 8: search page matches SearchScreen.kt, SearchKeyboard.kt and SearchBar.kt', () => {
	it('labels are lowercase (SearchKeyboard.kt:15-47)', () => {
		expect(source('SearchKeyboard.vue')).not.toContain('toUpperCase');
	});

	it('space, backspace, video, music, letters and digits are one 6-column grid (SearchKeyboard.kt:15-47)', () => {
		const html = source('SearchKeyboard.vue').split('<style')[0]!;

		expect(html.match(/class="kb-grid"/g)).toHaveLength(1);
		expect(html).not.toContain('utility-row');
	});

	it('key: 22/28 weight 400 on one surface color (:127-137,:170-188)', () => {
		const k = decls(`${S}SearchKey.vue`, '.key');

		expect(k['font-size']).toBe('22px');
		expect(k['line-height']).toBe('28px');
		expect(k['font-weight']).toBe('400');
		expect(k.background).toBe('var(--cast-bg-base)');
		expect(decls(`${S}SearchKey.vue`, '.key-hot').background).toBeUndefined();
		expect(decls(`${S}SearchKey.vue`, '.key-number').background).toBeUndefined();
		expect(decls(`${S}SearchKey.vue`, '.key-mode').background).toBeUndefined();
	});

	it('focus border is onSurface and the active mode key tints with onSurface (:121-124,:176-177)', () => {
		expect(decls(`${S}SearchKey.vue`, '.key:focus-visible')['border-color']).toBe('var(--cast-text-primary)');
		expect(decls(`${S}SearchKey.vue`, '.key-mode-active').color).toBe('var(--cast-text-primary)');
	});

	it('bar text is bodyMedium 14/20/0.25 (SearchBar.kt:13-81)', () => {
		const t = decls(`${S}SearchScreen.vue`, '.query-text');

		expect(t['font-size']).toBe('14px');
		expect(t['line-height']).toBe('20px');
		expect(t['letter-spacing']).toBe('0.25px');
	});

	it('the keyboard column is a quarter of the whole row, 222 px at 960 (SearchScreen.kt:40-52)', () => {
		expect(decls(`${S}SearchScreen.vue`, '.search')['grid-template-columns']).toBe('calc((100vw - 72px) / 4) 1fr');
	});
});
