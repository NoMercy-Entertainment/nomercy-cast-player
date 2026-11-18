import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const NAV = 'layout/NavLink.vue';
const CSS = 'styles/components.css';

describe('nav matches TvNavigationBar.kt', () => {
	it('nav.bar: pad 36, center gap 16 and pad 4/16/8 (:140-146,:178,:186)', () => {
		expect(decls('layout/TopNavBar.vue', '.topnav').padding).toBe('0 36px');
		expect(decls('layout/TopNavBar.vue', '.nav-items').gap).toBe('28px');
		expect(decls('layout/TopNavBar.vue', '.nav-items').padding).toBe('4px 16px 8px');
	});

	it('nav.logo: 52 (:152)', () => {
		expect(decls('layout/TopNavBar.vue', '.brand-logo').width).toBe('52px');
		expect(decls('layout/TopNavBar.vue', '.brand-logo').height).toBe('52px');
	});

	it('nav.pill: pad 4/12/4/8, 13 sp, gradient when selected, no relative color (:366-393)', () => {
		const p = decls(NAV, '.nav-link');

		expect(p.padding).toBe('4px 12px 4px 8px');
		expect(p.height).toBe('auto');
		expect(p['font-size']).toBe('13px');
		expect(decls(NAV, '.nav-link.icon-only').width).toBe('36px');
		const a = decls(NAV, '.nav-link.active');

		expect(a.background).toBe('transparent');
		expect(decls(NAV, '.nav-link.active::before').background).toBe('var(--color-primary, oklch(0.7 0.2 285))');
		expect(a['box-shadow']).toBe('0 6px 16px rgba(0, 0, 0, 0.35)');
	});

	it('nav.profile: focused primary gradient, shadow 2, no lift (:215,:225-228,:262-263)', () => {
		const c = decls('layout/ProfileChip.vue', '.profile-chip:focus-visible');

		expect(c.transform).toBeUndefined();
		expect(decls('layout/ProfileChip.vue', '.profile-chip:focus-visible::before').background).toContain('var(--color-primary');
		expect(decls('layout/ProfileChip.vue', '.profile-chip')['box-shadow']).toBe('0 2px 4px rgba(0, 0, 0, 0.3)');
	});

	// The artist line is TrackLinks.kt:44 labelSmall; Typography.kt:5-7 overrides nothing, so Material3's 11.
	it('nav.miniplayer: 360 wide, gap 8, title 10 / 12, artist 11 (MiniPlayer.kt:119-215)', () => {
		const m = decls('layout/TvMiniPlayer.vue', '.mini-player');

		expect(m.width).toBe('360px');
		expect(m.gap).toBe('8px');
		expect(decls('layout/TvMiniPlayer.vue', '.title')['font-size']).toBe('10px');
		expect(decls('layout/TvMiniPlayer.vue', '.title')['line-height']).toBe('12px');
		expect(decls('layout/TvMiniPlayer.vue', '.artist')['font-size']).toBe('11px');
		expect(decls('layout/TvMiniPlayer.vue', '.mini-player:focus-visible').transform).toBeUndefined();
	});

	it('dpad.nav.focus-ring: the global rule no longer hides the nav ring; ring is 2 px primary, 6 px gap, r24 (:303-318)', () => {
		expect(decls('styles/tv-safe.css', '.nav-link[data-focusable]:focus-visible')).toEqual({});
		const r = decls(NAV, '.nav-link::after');

		expect(r.inset).toBe('-6px');
		expect(r['border-radius']).toBe('24px');
		expect(decls(NAV, '.nav-link:focus-visible::after')['border-color']).toBe('var(--color-primary, oklch(0.7 0.2 285))');
	});
});

describe('focus rings match the KMP theme (TvFocusRing.kt:50-55, AppSettingsScreen.kt:543)', () => {
	it('focus.ring.tv: rows r10, focused ring white', () => {
		expect(decls(CSS, '.nm-list-row')['border-radius']).toBe('10px');
		expect(decls(CSS, '.nm-list-row:focus-visible')['border-color']).toBe('var(--cast-white)');
	});

	it('focus.ring.player: panel buttons get a 2 px white ring (PlayerUiHelpers.kt:71-75)', () => {
		const f = decls('styles/tv-safe.css', '.panel-button:focus-visible');

		expect(f.outline).toBe('2px solid var(--cast-white)');
	});

	it('focus.ring.indicator: 3 px white, 1.08 scale kept (TvFocusRing.kt:50-55)', () => {
		const p = 'players/music/ProgressControls.vue';

		// Chrome 92 outlines ignore border-radius, so the ring is the 3 px border, as the nav util buttons do.
		expect(decls(p, '.ctrl-btn:focus-visible')['border-color']).toBe('var(--cast-white)');
		expect(decls(p, '.ctrl-btn').border).toBe('3px solid transparent');
		const n = 'views/now-playing/NowPlayingScreen.vue';

		expect(decls(n, '.util-btn').border).toBe('3px solid transparent');
		expect(decls(n, '.util-btn:focus-visible')['border-color']).toBe('var(--cast-white)');
	});
});

describe('buttons match NMDetailActions.kt / LinkButton.kt', () => {
	it('button.watch: 260 x 44, r12, outline type, 14 / 18, gap 8 (:41,:103,:109,:118)', () => {
		const b = decls(CSS, '.nm-pill');

		expect(b.width).toBe('260px');
		expect(b.height).toBe('44px');
		expect(b.padding).toBe('0 12px');
		expect(b['border-radius']).toBe('12px');
		expect(b.border).toBe('1px solid rgba(255, 255, 255, 0.18)');
		expect(b['font-size']).toBe('14px');
		expect(b['line-height']).toBe('18px');
		expect(b.gap).toBe('8px');
		expect(b.background).toBe('transparent');
		expect(decls(CSS, '.nm-pill-primary').color).toBe('var(--cast-text-primary)');
		expect(decls(CSS, '.nm-pill-primary').background).toBe('transparent');
	});

	it('button.watch focus: 3 px white .85 border, .06 fill, no lift', () => {
		const f = decls(CSS, '.nm-pill-primary:focus-visible');

		expect(f.border).toBe('3px solid rgba(255, 255, 255, 0.85)');
		expect(f.background).toBe('rgba(0, 0, 0, 0.06)');
		expect(f.transform).toBeUndefined();
	});

	it('button.trailer / watchlist: same as watch', () => {
		const s = decls(CSS, '.nm-pill-secondary');

		expect(s.background).toBe('transparent');
		expect(s['border-color']).toBe('rgba(255, 255, 255, 0.18)');
		expect(decls(CSS, '.nm-pill-secondary:focus-visible').border).toBe('3px solid rgba(255, 255, 255, 0.85)');
	});

	it('info actions column: pad 12/24/24/40, gap 8 (InfoScreen.kt:239-249)', () => {
		const a = decls('views/info/InfoScreen.vue', '.actions');

		expect(a.padding).toBe('12px 24px 24px 40px');
		expect(a.gap).toBe('8px');
	});
});
