import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const CSS = 'styles/components.css';
const NAV = 'layout/NavLink.vue';
const CARD = 'server-components/NMCard.vue';
const CAROUSEL = 'server-components/NMCarousel.vue';
const MUSIC = 'server-components/NMMusicCard.vue';

describe('row 0: a plain Compose Text is Material 3 bodyLarge (16/24, spacing 0.5)', () => {
	it('body carries the shared base text style', () => {
		const b = decls('styles/tailwind.css', 'body');

		expect(b['font-size']).toBe('16px');
		expect(b['line-height']).toBe('24px');
		expect(b['letter-spacing']).toBe('0.5px');
		expect(b['font-weight']).toBe('400');
	});

	it('Android View TextView twins reset spacing and line height (item_card_poster.xml, item_tv_row.xml)', () => {
		expect(decls(CARD, '.caption')['letter-spacing']).toBe('0');
		expect(decls(CARD, '.caption')['line-height']).toBe('normal');
		expect(decls(CAROUSEL, '.show-all')['letter-spacing']).toBe('0');
		expect(decls(CAROUSEL, '.show-all')['line-height']).toBe('normal');
	});
});

describe('row 1: top nav bar matches TvNavigationBar.kt', () => {
	it('label is bodyLarge at 13: line 24, spacing 0.5 (:390-394)', () => {
		expect(decls(NAV, '.label')['line-height']).toBe('24px');
		expect(decls(NAV, '.label')['letter-spacing']).toBe('0.5px');
	});

	it('visible pill gap is 28 (16 + 6 + 6, :186,:313-318)', () => {
		expect(decls('layout/TopNavBar.vue', '.nav-items').gap).toBe('28px');
	});

	it('focus ring sits 4..6 out: inset -6 (:313-318)', () => {
		expect(decls(NAV, '.nav-link::after').inset).toBe('-6px');
	});

	it('icon-only pill is 36 x 28 (:375-379)', () => {
		expect(decls(NAV, '.nav-link.icon-only').padding).toBe('4px 0');
	});

	it('active pill fades primary to primary at 80 % with no black (:285-287)', () => {
		expect(decls(NAV, '.nav-link.active').background).toBe('transparent');
		const f = decls(NAV, '.nav-link.active::before');

		expect(f.background).toBe('var(--color-primary, oklch(0.7 0.2 285))');
		expect(f['-webkit-mask-image']).toBe('linear-gradient(90deg, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.8))');
	});

	it('logo has no shadow (AppLogoSquare.kt:26-36)', () => {
		expect(decls('layout/TopNavBar.vue', '.brand-logo').filter).toBeUndefined();
	});

	it('profile focus fades primary to primary at 80 % (:224-229)', () => {
		const p = 'layout/ProfileChip.vue';

		expect(decls(p, '.profile-chip:focus-visible').background).toBe('transparent');
		expect(decls(p, '.profile-chip:focus-visible::before')['-webkit-mask-image']).toBe(
			'linear-gradient(90deg, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.8))',
		);
	});
});

describe('row 2: hero text matches VideoMusicHeroSection.kt', () => {
	it('title spacing 0, subtitle white with spacing 0, overview spacing 0.25 (:146-159,:187-194)', () => {
		expect(decls(CSS, '.nm-hero-title-main')['letter-spacing']).toBe('0');
		expect(decls(CSS, '.nm-hero-title-sub')['letter-spacing']).toBe('0');
		expect(decls(CSS, '.nm-hero-title-sub').color).toBe('var(--cast-text-primary)');
		expect(decls(CSS, '.nm-hero-overview')['letter-spacing']).toBe('0.25px');
	});

	it('no text or logo shadow (:131-160,:173-194)', () => {
		for (const s of ['.nm-hero-title-main', '.nm-hero-title-sub', '.nm-hero-overview'])
			expect(decls(CSS, s)['text-shadow']).toBeUndefined();

		expect(decls(CSS, '.nm-hero-logo').filter).toBeUndefined();
	});
});

describe('row 3: rail title (item_tv_row.xml:15-26, NMCarousel.kt:267-281)', () => {
	it('video rows: 14 medium with spacing 0', () => {
		const h = decls(CAROUSEL, '.rail-header h2');

		expect(h['font-size']).toBe('14px');
		expect(h['font-weight']).toBe('500');
		expect(h['letter-spacing']).toBe('0');
	});

	it('music rows: bodyLarge 16/24/0.5/400, 2 px under the title', () => {
		const h = decls(CSS, '.nm-hero-rails.nm-hero-rails--music .rail-header h2');

		expect(h['font-size']).toBe('16px');
		expect(h['line-height']).toBe('24px');
		expect(h['letter-spacing']).toBe('0.5px');
		expect(h['font-weight']).toBe('400');
		expect(decls(CSS, '.nm-hero-rails.nm-hero-rails--music .rail-section').gap).toBe('2px');
	});
});

describe('row 4: cards (TvCardViewHolder.kt:86-102,190-196; NMMusicCard.kt:192,289-306)', () => {
	it('resting ring without a palette uses the page accent', () => {
		expect(decls(CARD, '.poster::after').border).toBe('1px solid var(--card-accent, var(--color-primary, var(--cast-accent)))');
	});

	it('Show All: #1A1A1A, no line clamp', () => {
		expect(decls(CAROUSEL, '.show-all').background).toBe('var(--cast-show-all-bg)');
		expect(decls('styles/tokens.css', ':root')['--cast-show-all-bg']).toBe('#1a1a1a');
		expect(decls(CAROUSEL, '.show-all-text')['-webkit-line-clamp']).toBeUndefined();
	});

	it('music card: cover inset 4, labelSmall 11/16/0.5/500, subtitle at 70 %', () => {
		expect(decls(MUSIC, '.cover').margin).toBe('4px');
		const n = decls(MUSIC, '.name');

		expect(n['font-size']).toBe('11px');
		expect(n['line-height']).toBe('16px');
		expect(n['letter-spacing']).toBe('0.5px');
		expect(n['font-weight']).toBe('500');
		const s = decls(MUSIC, '.subtitle');

		expect(s['font-size']).toBe('11px');
		expect(s['line-height']).toBe('16px');
		expect(s['font-weight']).toBe('500');
		expect(s.opacity).toBe('0.7');
	});
});
