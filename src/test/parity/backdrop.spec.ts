import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const CSS = 'styles/components.css';

describe('the backdrop fills the screen like BackdropImageWithOverlay.kt', () => {
	it('home: the art spans the screen, not the 264 hero box (NMLolomo.kt:233 inside a fillMaxSize box)', () => {
		expect(decls('views/home/HomeHero.vue', '.art').height).toBe('100vh');
		expect(decls('views/home/HomeHero.vue', '.hero').overflow).toBeUndefined();
	});

	it('info: the backdrop spans the screen (InfoScreen.kt:259-260)', () => {
		const b = decls('views/info/InfoScreen.vue', '.backdrop');

		expect(b.inset).toBe('0');
		expect(b.height).toBeUndefined();
	});

	it('the scrim center is the native device-pixel offset on a 960x540 screen at scale 2', () => {
		// :270-271 center (width - 225, -450) px, graphicsLayer scaleX 1.15 about the middle:
		// x = 480 + (847.5 - 480) * 1.15 = 902.6 css px from the left, so 57 px from the right.
		expect(decls(CSS, '.nm-hero-scrim').background).toContain('at calc(100% - 57px) -225px');
	});
});

describe('the info rows scroll under a pinned hero (InfoScreen.kt:266-272)', () => {
	it('the list starts at the hero height and clips its own scroll', () => {
		const list = decls('views/info/InfoScreen.vue', '.info-list');

		expect(list.position).toBe('absolute');
		expect(list.top).toBe('var(--hero-height)');
		expect(list['overflow-y']).toBe('auto');
	});
});

describe('the hero text keeps fixed blocks like LeftColumn (VideoMusicHeroSection.kt:98-100)', () => {
	it('the title block is 58 high and the overview block holds 5 lines', () => {
		expect(decls(CSS, '.nm-hero-title-block').height).toBe('58px');
		expect(decls(CSS, '.nm-hero-overview-block').height).toBe('100px');
	});
});
