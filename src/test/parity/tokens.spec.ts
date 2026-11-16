import { describe, expect, it } from 'vitest';
import { atDecls, decls } from '../cssDecl';

// Values come from fix-list.md; the .kt line is in the commit body.
describe('shared tokens match the KMP TV app', () => {
	const root = decls('styles/tokens.css', ':root');

	it('rail card size follows the KMP formula (TvHomeAdapter.kt:42-49)', () => {
		expect(root['--rail-card-width']).toBe('calc((100vw - 48px) / 7.7)');
		expect(root['--rail-card-height']).toBe('calc(var(--rail-card-width) * 1.5)');
		expect(root['--rail-card-gap']).toBe('8px');
	});

	it('card radius is 6 (TvCardViewHolder.kt:248)', () => {
		expect(atDecls('styles/tailwind.css', 'theme')['--radius-card']).toBe('6px');
	});

	it('nav, hero and overlap tokens (TvNavigationBar.kt:62, NMLolomo.kt:285)', () => {
		expect(root['--topnav-height']).toBe('70px');
		expect(root['--hero-height']).toBe('264px');
		expect(root['--hero-rails-overlap']).toBe('10px');
	});
});

describe('shared focus ring is a 2 px white stroke without scale (TvCardViewHolder.kt:68-72)', () => {
	it('nm-focus-scale does not scale', () => {
		expect(decls('styles/components.css', '.nm-focus-scale:focus-visible').transform).toBe('none');
		expect(decls('styles/components.css', '.nm-focus-scale-sm:focus-visible').transform).toBe('none');
	});

	it('the ring is white with no glow', () => {
		const ring = decls(
			'styles/components.css',
			'.nm-focus-scale:focus-visible .nm-focus-ring',
		);
		expect(ring['box-shadow']).toBe('0 0 0 2px #fff');
	});

	it('the global card scale rule is gone', () => {
		expect(decls('styles/tv-safe.css', '[data-focusable].card:focus-visible').transform).toBeUndefined();
	});
});

describe('hero rails layout (NMLolomo.kt:251, VideoContentList.kt:590-598)', () => {
	const rails = decls('styles/components.css', '.nm-hero-rails');

	it('rows gap 8, bottom 120, fill below the hero', () => {
		expect(rails.gap).toBe('8px');
		expect(rails.padding).toBe('8px 0 120px');
		expect(rails.height).toBe('calc(100% - 254px)');
	});
});

describe('hero scrim (BackdropImageWithOverlay.kt:253-285)', () => {
	it('is the KMP radial: transparent to 25 %, black from 37.5 %', () => {
		const bg = decls('styles/components.css', '.nm-hero-scrim').background;
		expect(bg).toBe(
			'radial-gradient( ellipse 1987px 1728px at calc(100% - 187px) -450px, transparent 0%, transparent 25%, #000 37.5%, #000 100% )',
		);
	});
});
