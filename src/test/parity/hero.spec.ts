import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const CSS = 'styles/components.css';

describe('hero matches VideoMusicHeroSection.kt', () => {
	it('hero.container: bottom aligned, pad 40/16/12, gap 12, 200 ms crossfade (:107-108,:124-127)', () => {
		const c = decls('views/home/HomeHero.vue', '.content');

		expect(c.padding).toBe('0 16px 12px 40px');
		expect(c['justify-content']).toBe('flex-end');
		expect(c.gap).toBe('12px');
		expect(decls('views/home/HomeHero.vue', '.hero-fade-enter-active').transition).toBe('opacity 200ms ease');
	});

	it('hero.logo: height 58 for every hero (:97,:139)', () => {
		expect(decls(CSS, '.nm-hero-logo')['max-height']).toBe('58px');
		expect(decls(CSS, '.nm-hero-logo')['max-width']).toBe('420px');
	});

	it('hero.title: 28sp lh 26, sub 19sp lh 24 (:148-158)', () => {
		expect(decls(CSS, '.nm-hero-title-main')['line-height']).toBe('26px');
		expect(decls(CSS, '.nm-hero-title-sub')['line-height']).toBe('24px');
	});

	it('hero.overview: 14sp Medium lh 20, 5 lines on home and info (:98,:187-193)', () => {
		const o = decls(CSS, '.nm-hero-overview');

		expect(o['font-size']).toBe('14px');
		expect(o['font-weight']).toBe('500');
		expect(o['line-height']).toBe('20px');
		expect(o['-webkit-line-clamp']).toBe('5');
		expect(decls('views/info/InfoScreen.vue', '.info-overview')).toEqual({});
	});
});

describe('info header follows the hero (InfoScreen.kt:213,260)', () => {
	it('info.header: 264 high hero row, 60 % wide, bottom aligned', () => {
		const r = decls('views/info/InfoScreen.vue', '.hero-row');

		expect(r.height).toBe('var(--hero-height)');
		expect(r.width).toBe('60%');
		expect(r.padding).toBe('0 16px 12px 40px');
		expect(r['justify-content']).toBe('flex-end');
	});

	it('info.backdrop: full screen behind the rows (InfoScreen.kt:259-260), same scrim as the home hero', () => {
		expect(decls('views/info/InfoScreen.vue', '.backdrop').inset).toBe('0');
		expect(decls('views/info/InfoScreen.vue', '.scrim')).toEqual({});
	});
});
