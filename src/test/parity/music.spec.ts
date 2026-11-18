import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const L = 'views/music/MusicListScreen.vue';
const PC = 'players/music/ProgressControls.vue';

describe('music list matches ListScreen.kt / TrackRow.kt', () => {
	it('music.list.layout: right column pad top 16, gap 12 (ListScreen.kt:141-179)', () => {
		const t = decls(L, '.tracks-col');

		expect(t['padding-top']).toBe('16px');
		expect(t.gap).toBe('12px');
		expect(t.display).toBe('flex');
	});

	it('music.list.header: cover r12, end pad 60, shadow 4 (ListScreen.kt:269-296)', () => {
		const c = decls(L, '.cover');

		expect(c['border-radius']).toBe('12px');
		expect(c.width).toBe('calc(100% - 60px)');
		expect(c['box-shadow']).toBe('0 4px 4px rgba(0, 0, 0, 0.25)');
	});

	it('music.list.title: name 28 ExtraBold, type 16, year 14 (ListScreen.kt:311-331)', () => {
		expect(decls(L, '.title')['font-size']).toBe('28px');
		expect(decls(L, '.title')['font-weight']).toBe('800');
		expect(decls(L, '.kind')['font-size']).toBe('16px');
		expect(decls(L, '.meta')['font-size']).toBe('14px');
	});

	it('music.track-row: pad 8/12/8/16, min 48, white focus border (TrackRow.kt:94-122)', () => {
		const r = decls(L, '.track-row');

		expect(r.padding).toBe('8px 12px 8px 16px');
		expect(r['min-height']).toBe('48px');
		expect(decls(L, '.track-row:focus-visible')['border-color']).toBe('var(--cast-white)');
	});
});

describe('full player matches FullPlayerScreen.kt', () => {
	it('music.full.top-row: title 36, gap 16 (:188-205,470-483)', () => {
		const h = 'players/music/NowPlayingHero.vue';

		expect(decls(h, '.title')['font-size']).toBe('36px');
		expect(decls(h, '.hero').gap).toBe('16px');
	});

	it('music.full.bottom-bar: pill h90, 32 outside and 24 inside, black .4 r16, play 64 (:539-554)', () => {
		const b = decls(PC, '.buttons');

		expect(b.height).toBe('90px');
		expect(b.margin).toBe('0 32px');
		expect(b.padding).toBe('0 24px');
		expect(b.background).toBe('rgba(0, 0, 0, 0.4)');
		expect(b['border-radius']).toBe('16px');
		const p = decls(PC, '.ctrl-play');

		expect([p.width, p.height]).toEqual(['64px', '64px']);
	});

	it('music.full.play-button: gradient and shadow 12 (:612-618)', () => {
		const p = decls(PC, '.ctrl-play');

		expect(p.background).toContain('linear-gradient(');
		expect(p['box-shadow']).toBe('0 12px 12px rgba(0, 0, 0, 0.3)');
	});

	it('music.full.scrim: side padding 48 (:267-374)', () => {
		expect(decls('views/now-playing/NowPlayingScreen.vue', '.content').padding).toBe('0 48px');
	});
});
