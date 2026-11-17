import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const S = 'views/search/';
const F = 'components/feedback/';

describe('search matches SearchScreen.kt / SearchKeyboard.kt', () => {
	it('search.layout: left column 25 percent (SearchScreen.kt:76-114)', () => {
		expect(decls(`${S}SearchScreen.vue`, '.search')['grid-template-columns']).toBe('calc((100vw - 72px) / 4) 1fr');
	});

	it('search.keyboard: 6 columns, gap 4, pad 4 (SearchKeyboard.kt:55-82)', () => {
		const k = decls(`${S}SearchKeyboard.vue`, '.kb');

		expect(k.gap).toBe('4px');
		expect(k.padding).toBe('4px');
	});

	it('search.keyboard.key: titleLarge 22 label (SearchKeyboard.kt:170-188)', () => {
		expect(decls(`${S}SearchKey.vue`, '.key')['font-size']).toBe('22px');
	});

	it('search.bar: h60, pad h16, r16 (SearchBar.kt:57,64,43)', () => {
		const b = decls(`${S}SearchScreen.vue`, '.query-bar');

		expect(b.height).toBe('60px');
		expect(b.padding).toBe('0 16px');
		expect(b['border-radius']).toBe('16px');
		expect(b['align-items']).toBe('center');
	});
});

describe('states match LoadingIndicator.kt / ErrorCard.kt / EmptyGrid.kt / SetupBackdrop.kt', () => {
	it('state.loading: 50 spinner, stroke 4, white (LoadingIndicator.kt:20-22)', () => {
		const r = decls(`${F}LoadingIndicator.vue`, '.ring');

		expect([r.width, r.height]).toEqual(['50px', '50px']);
		expect(r.border).toBe('4px solid rgba(255, 255, 255, 0.18)');
		expect(r['border-top-color']).toBe('var(--cast-white)');
	});

	it('state.error: column max 440, pad 96/40/0, 34 ExtraBold title, error message (ErrorCard.kt:121-164)', () => {
		const p = decls(`${F}ErrorPanel.vue`, '.error-panel');

		expect(p['max-width']).toBe('440px');
		expect(p.padding).toBe('96px 40px 0');
		expect(p['align-items']).toBe('flex-start');
		const t = decls(`${F}ErrorPanel.vue`, '.error-title');

		expect([t['font-size'], t['line-height'], t['font-weight']]).toEqual(['34px', '40px', '800']);
		expect(decls(`${F}ErrorPanel.vue`, '.error-message').color).toBe('var(--color-error)');
	});

	it('state.empty: 20 / 28 centered (EmptyGrid.kt:30-37)', () => {
		const m = decls(`${F}EmptyState.vue`, '.empty-message');

		expect(m['line-height']).toBe('28px');
		expect(m['text-align']).toBe('center');
	});

	it('state.setup-backdrop: black base (SetupBackdrop.kt:108-124)', () => {
		expect(decls('components/SetupBackdrop.vue', '.setup-backdrop').background).toBe('var(--cast-black)');
	});
});
