import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const SC = 'server-components/';

describe('server components match the KMP NM components', () => {
	it('nm.NMGrid: spacing 16, top 64, end spacing/2 (NMGrid.kt:41-60,118-125)', () => {
		const t = decls(`${SC}NMGrid.vue`, '.grid-track');

		expect(t.gap).toBe('16px');
		expect(t.padding).toBe('64px 20px 16px 16px');
	});

	it('nm.NMList: spacing 16 (NMList.kt:27)', () => {
		expect(decls(`${SC}NMList.vue`, '.list-track').gap).toBe('16px');
	});

	it('nm.NMContainer: h-pad 8, v-pad 16 (NMContainer.kt:25-27)', () => {
		expect(decls(`${SC}NMContainer.vue`, '.container-row').padding).toBe('16px 8px');
		expect(decls(`${SC}NMContainer.vue`, '.container-header').padding).toBe('0 8px');
	});

	it('nm.NMEmptyState: gap 12, pad h40 v48 (NMEmptyState.kt:53-59)', () => {
		const e = decls('components/feedback/EmptyState.vue', '.empty-state');

		expect(e.gap).toBe('12px');
		expect(e.padding).toBe('48px 40px');
	});

	it('nm.NMGenreCard: r8, 1 px .08 rest border, 3 px ring on focus (NMGenreCard.kt:70-137)', () => {
		const g = decls(`${SC}NMGenreCard.vue`, '.genre-card');

		expect(g['border-radius']).toBe('8px');
		expect(g.border).toBe('1px solid rgba(255, 255, 255, 0.08)');
		expect(decls(`${SC}NMGenreCard.vue`, '.genre-card:focus-visible').border).toBe('3px solid var(--cast-white)');
	});

	it('nm.NMHomeCard: hero height 264, pad t24 b0 s40 e40 (NMHomeCard.kt:121-200)', () => {
		const h = decls(`${SC}NMHomeCard.vue`, '.hero');

		expect(h.height).toBe('var(--hero-height)');
		expect(h['min-height']).toBeUndefined();
		expect(h['max-height']).toBeUndefined();
		expect(decls(`${SC}NMHomeCard.vue`, '.content').padding).toBe('24px 40px 0');
	});

	it('nm.NMMusicHomeCard: a row, cover 96 r16, card r20 pad 8 gap 12, title 18 (NMMusicHomeCard.kt:161-232)', () => {
		const c = decls(`${SC}NMMusicHomeCard.vue`, '.music-home-card');

		expect(c['flex-direction']).toBe('row');
		expect(c.gap).toBe('12px');
		expect(c.padding).toBe('8px');
		expect(c['border-radius']).toBe('20px');
		expect(c.width).toBe('auto');
		const v = decls(`${SC}NMMusicHomeCard.vue`, '.cover');

		expect(v.width).toBe('96px');
		expect(v['border-radius']).toBe('16px');
		expect(decls(`${SC}NMMusicHomeCard.vue`, '.name')['font-size']).toBe('18px');
	});

	it('nm.NMTopResultCard: h64, image 52 r4, pad 8, title 14, meta 12 (NMTopResultCard.kt:82-152)', () => {
		const f = `${SC}NMTopResultCard.vue`;
		const t = decls(f, '.top-result');

		expect(t.height).toBe('64px');
		expect(t['grid-template-columns']).toBe('52px 1fr');
		expect(t.padding).toBe('0 8px');
		expect(t.gap).toBe('8px');
		const a = decls(f, '.art');

		expect([a.width, a.height, a['border-radius']]).toEqual(['52px', '52px', '4px']);
		expect(decls(f, '.title')['font-size']).toBe('14px');
		expect(decls(f, '.subtitle')['font-size']).toBe('12px');
		expect(decls(f, '.kind')['font-size']).toBe('12px');
	});

	it('nm.NMTrackRow: h48, cover 40 r4, surfaceVariant .2 (NMTrackRow.kt:113-186)', () => {
		const f = `${SC}NMTrackRow.vue`;
		const r = decls(f, '.track-row');

		expect(r.height).toBe('48px');
		expect(r.background).toBe('oklch(0.18 0.015 250 / 0.2)');
		const c = decls(f, '.cover');

		expect([c.width, c.height, c['border-radius']]).toEqual(['40px', '40px', '4px']);
	});
});
