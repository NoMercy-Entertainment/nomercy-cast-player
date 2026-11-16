import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const T = 'styles/tv-safe.css';

describe('player overlays match the KMP TV player', () => {
	it('player.osd: band pad 32/52, gradient to .9, still a bottom band (TVBottomBar.kt:58-63)', () => {
		const o = decls(T, '.playback-osd');
		expect(o.padding).toBe('32px 52px');
		expect(o.background).toBe('linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.55) 50%, transparent 100%)');
		expect(o.background).not.toContain('backdrop');
	});

	it('player.osd.bottom-bar: time 14 mono, remaining white .7 (TVBottomBar.kt:58-134)', () => {
		const t = decls(T, '.osd-time');
		expect(t['font-size']).toBe('14px');
		expect(t['font-family']).toBe('ui-monospace, monospace');
		expect(decls(T, '.osd-remaining').color).toBe('rgba(255, 255, 255, 0.7)');
	});

	it('player.osd.progress: track 8 r4 LightGray .4, played white .8 (ChapterProgressBar.kt:99-255)', () => {
		const b = decls(T, '.osd-bar');
		expect(b.height).toBe('8px');
		expect(b['border-radius']).toBe('4px');
		expect(b.background).toBe('rgba(211, 211, 211, 0.4)');
		expect(decls(T, '.osd-bar-fill').background).toBe('rgba(255, 255, 255, 0.8)');
	});

	it('player.osd.seek: bar 8, fill white .8 (TVSeekContainer.kt:189-220)', () => {
		expect(decls(T, '.seek-bar').height).toBe('8px');
		expect(decls(T, '.seek-fill').background).toBe('rgba(255, 255, 255, 0.8)');
	});

	it('player.osd.skip: side 52, bottom 132, #262630EB, white when focused (SkipOverlay.kt:107-157)', () => {
		const s = decls(T, '.skip-chapter-prompt');
		expect([s.right, s.bottom, s.background]).toEqual(['52px', '132px', 'var(--cast-skip-bg)']);
		const f = decls(T, '.skip-chapter-prompt:focus-visible');
		expect([f.background, f.color]).toEqual(['var(--cast-white)', 'var(--cast-skip-ink)']);
	});

	it('player.osd.menu-item: r12, pad 8/12, min 44, 15, current .12, focus 3 px .85 (TvSelectableMenuItem.kt:50-92)', () => {
		const r = decls(T, '.lang-section .track-row');
		expect(r['border-radius']).toBe('12px');
		expect(r.padding).toBe('8px 12px');
		expect(r['min-height']).toBe('44px');
		expect(r['font-size']).toBe('15px');
		expect(r.border).toBe('3px solid transparent');
		expect(decls(T, '.lang-section .track-row.current').background).toBe('rgba(255, 255, 255, 0.12)');
		expect(decls(T, '.lang-section .track-row:focus-visible')['border-color']).toBe('rgba(255, 255, 255, 0.85)');
	});

	it('player.osd.episode-dialog: pad 32, thumb 180 r6, card r8, scrim .9, lines 18/16 (EpisodeDialog.kt:101-117)', () => {
		expect(decls(T, '.episode-layout').padding).toBe('32px');
		expect(decls(T, '.episode-screen').background).toBe('rgba(0, 0, 0, 0.9)');
		const th = decls(T, '.episode-thumb');
		expect([th.width, th['border-radius']]).toEqual(['180px', '6px']);
		expect(decls(T, '.episode-card')['border-radius']).toBe('8px');
		expect(decls(T, '.episode-title')['line-height']).toBe('18px');
		expect(decls(T, '.episode-description')['line-height']).toBe('16px');
	});

	it('player.osd.language-dialog: pad 32/40, gap 24, scrim .8 (LanguageDialog.kt:75-180)', () => {
		const s = decls(T, '.language-screen');
		expect([s.padding, s.background]).toEqual(['32px 40px', 'rgba(0, 0, 0, 0.8)']);
		expect(decls(T, '.language-layout').gap).toBe('24px');
	});

	it('player.osd.prescreen: pad 32, title 28/26, sub 19/24 no caps, overview 14/20 (PreScreenDialog.kt:118-376)', () => {
		expect(decls(T, '.pre-screen-content').padding).toBe('32px');
		const t = decls(T, '.pre-screen-title');
		expect([t['font-size'], t['line-height']]).toEqual(['28px', '26px']);
		const s = decls(T, '.pre-screen-subtitle');
		expect([s['font-size'], s['line-height'], s['text-transform']]).toEqual(['19px', '24px', 'none']);
		const o = decls(T, '.pre-screen-overview');
		expect([o['font-size'], o['line-height']]).toEqual(['14px', '20px']);
	});
});
