import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const RAIL = 'components/rails/HorizontalRail.vue';
const CAROUSEL = 'server-components/NMCarousel.vue';

describe('rail matches TvHomeAdapter.kt / item_tv_row.xml', () => {
	it('rail.row: start and end padding 40, only room for the ring (item_tv_row.xml:34-35)', () => {
		expect(decls(RAIL, '.rail-track').padding).toBe('2px 40px');
		expect(decls(RAIL, '.rail-track:empty')['min-height']).toBe('calc(var(--rail-card-height) + 4px)');
	});

	it('rail.title: 36 high, pad 40/16/4/4, 14 Medium (TvHomeAdapter.kt:525-534)', () => {
		const h = decls(CAROUSEL, '.rail-header');
		expect(h.height).toBe('36px');
		expect(h.padding).toBe('4px 16px 4px 40px');
		expect(h['align-items']).toBe('center');
		expect(decls(CAROUSEL, '.rail-header h2')['font-size']).toBe('14px');
		expect(decls(CAROUSEL, '.rail-header h2')['font-weight']).toBe('500');
	});

	it('the skeleton follows the real rail so nothing moves on load (ui class 1.2, 2.11)', () => {
		const s = 'components/feedback/Skeleton.vue';
		expect(decls(s, '.skeleton-title').height).toBe('36px');
		expect(decls(s, '.skeleton-track').padding).toBe('2px 40px');
	});
});

describe('cards match item_card_poster.xml / TvCardViewHolder.kt', () => {
	it('card.show-all: 16 Medium, pad 12, #1A1A1A, accent stroke, white focus (:195)', () => {
		const a = decls(CAROUSEL, '.show-all');
		expect(a['font-size']).toBe('16px');
		expect(a['font-weight']).toBe('500');
		expect(a.padding).toBe('12px');
		expect(a.background).toBe('var(--nm-surface)');
		expect(a.border).toBe('1px solid var(--color-primary, var(--cast-white))');
		const f = decls(CAROUSEL, '.show-all:focus-visible');
		expect(f['border-color']).toBe('var(--cast-white)');
		expect(f['box-shadow']).toBe('0 0 0 1px var(--cast-white)');
	});

	it('card.poster: resting 1 px palette stroke, replaced by the white ring on focus (:79-102)', () => {
		const n = 'server-components/NMCard.vue';
		expect(decls(n, '.poster::after').border).toBe('1px solid var(--card-accent, rgba(255, 255, 255, 0.18))');
		expect(decls(n, '.card:focus-visible .poster::after')['border-color']).toBe('transparent');
	});

	it('card.backdrop: width (screen - 40 - 42 - 3 * 8) / 3 (TvHomeAdapter.kt:68-75)', () => {
		const h = decls('server-components/NMHeroCard.vue', '.hero-card');
		expect(h.width).toBe('calc((100vw - 40px - 42px - 24px) / 3)');
		expect(h.flex).toBe('0 0 calc((100vw - 40px - 42px - 24px) / 3)');
	});

	it('card.group: 2:3 gradient cover with an accent stroke, title hidden (:156-159,:98)', () => {
		const g = 'server-components/NMGroupCard.vue';
		expect(decls(g, '.cover')['aspect-ratio']).toBe('2 / 3');
		expect(decls(g, '.cover').background).toBe('var(--nm-surface)');
		expect(decls(g, '.cover::before').opacity).toBe('0.45');
		expect(decls(g, '.cover::after').border).toBe('1px solid var(--color-primary, var(--cast-white))');
		expect(decls(g, '.meta').position).toBe('absolute');
	});
});
