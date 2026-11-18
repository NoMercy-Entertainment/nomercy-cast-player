import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import NowPlayingScreen from '@/views/now-playing/NowPlayingScreen.vue';
import NowPlayingHero from '@/players/music/NowPlayingHero.vue';
import ProgressControls from '@/players/music/ProgressControls.vue';
import { playbackStore } from '@/stores/playbackStore';
import { settingsStore } from '@/stores/settingsStore';
import { syncedSettings } from '@/lib/syncedSettings';
import { decls } from '../cssDecl';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

Element.prototype.scrollIntoView = vi.fn();

const HERO = 'players/music/NowPlayingHero.vue';
const BAR = 'players/music/ProgressControls.vue';
const SCREEN = 'views/now-playing/NowPlayingScreen.vue';

const palette = { cover: { dominant: '#AA2244', darkVibrant: '#661122' } };

function track(extra: object = {}): void {
	playbackStore.music.applyTrack({
		id: 't1',
		name: 'Song',
		artist: 'Band',
		duration_ms: 200000,
		...extra,
	} as never, []);
}

afterEach(() => {
	document.body.innerHTML = '';
	vi.useRealTimers();
	playbackStore.music.applyLyricsOpen(false);
	settingsStore.tvDarkMode.value = false;
	syncedSettings.value = {};
});

describe('the title row matches TopRowTV', () => {
	it('music-20: cover radius 8, no shadow; title and artist carry no text shadow or letter spacing (FullPlayerScreen.kt:460-484, FullPlayerScreen.kt:475 CoverArtwork)', () => {
		expect(decls(HERO, '.art')['border-radius']).toBe('8px');
		expect(decls(HERO, '.art')['box-shadow']).toBeUndefined();
		expect(decls(HERO, '.title')['text-shadow']).toBeUndefined();
		expect(decls(HERO, '.title')['letter-spacing']).toBeUndefined();
		expect(decls(HERO, '.artist')['text-shadow']).toBeUndefined();
	});

	it('music-21: lyrics scale the title 0.72 and the artist with it, gap 2 (FullPlayerScreen.kt:190-205, 470-483)', () => {
		expect(decls(HERO, '.hero.is-compact .title')['font-size']).toBe('calc(36px * 0.72)');
		expect(decls(HERO, '.hero.is-compact .artist')['font-size']).toBe('calc(22px * 0.72)');
		expect(decls(HERO, '.hero.is-compact .meta').gap).toBe('2px');
	});

	it('music-22: hidden controls give artwork 120 and scale 0.85 (FullPlayerScreen.kt:190-202)', () => {
		expect(decls(HERO, '.hero.is-idle .art').width).toBe('120px');
		expect(decls(HERO, '.hero.is-idle .title')['font-size']).toBe('calc(36px * 0.85)');
		expect(decls(HERO, '.hero.is-idle .artist')['font-size']).toBe('calc(22px * 0.85)');
	});

	it('music-22: the idle prop sets is-idle, and lyrics win over idle', () => {
		track();
		const idle = mount(NowPlayingHero, { props: { idle: true } });

		expect(idle.classes()).toContain('is-idle');
		expect(mount(NowPlayingHero, { props: { idle: true, compact: true } }).classes()).not.toContain('is-idle');
	});
});

describe('the bottom bar matches BottomBar and MusicProgressRow', () => {
	beforeEach(() => track());

	it('music-23: buttons are 48 with no fill, play is 64, spacers 24/8/16 (FullPlayerScreen.kt:536-562, MusicButton.kt:19)', () => {
		const btn = decls(BAR, '.ctrl-btn');

		expect([btn.width, btn.height]).toEqual(['48px', '48px']);
		expect(btn.background).toBe('transparent');
		expect(decls(BAR, '.ctrl-aux').width).toBeUndefined();

		const pill = decls(BAR, '.buttons');

		expect(pill.margin).toBe('0 32px');
		expect(pill.padding).toBe('0 24px');
		expect(pill.gap).toBe('8px');
		expect(decls(BAR, '.ctrl-play').margin).toBe('0 8px');
	});

	it('music-23: icons are 28 (MoooomIcon.kt:23), play icon 36 and white (FullPlayerScreen.kt:627, :554)', () => {
		const wrapper = mount(ProgressControls);
		const icon = (label: string) => wrapper.find(`[aria-label="${label}"] svg`);

		expect(icon('Shuffle').attributes('width')).toBe('28');
		expect(icon('Previous track').attributes('width')).toBe('28');
		expect(icon('Next track').attributes('width')).toBe('28');
		expect(wrapper.find('.ctrl-play svg').attributes('width')).toBe('36');
		expect(decls(BAR, '.ctrl-play').color).toBe('var(--play-fg, var(--cast-white))');
		expect(decls(BAR, '.ctrl-aux').color).toBeUndefined();
	});

	it('music-24: the focus ring is a 3 px inner border at scale 1.08 with no fill change (TvFocusRing.kt:41-51)', () => {
		const f = decls(BAR, '.ctrl-btn:focus-visible');

		expect(f.transform).toBe('scale(1.08)');
		expect(f['border-color']).toBe('var(--cast-white)');
		expect(f.background).toBeUndefined();
		expect(f.outline).toBe('none');
		expect(decls(BAR, '.ctrl-btn').border).toBe('var(--focus-ring-width) solid transparent');
		expect(decls(BAR, '.side-btn').border).toBe('var(--focus-ring-width) solid transparent');
		expect(decls('players/music/TvPanelToggles.vue', '.toggle-btn').border).toBe('var(--focus-ring-width) solid transparent');
		// The bottom stop stays see-through (FullPlayerScreen.kt:617); an opaque token would darken the button.
		expect(decls(BAR, '.ctrl-play').background).toContain('oklch(0.12 0.01 250 / 0.1)');
	});

	it('music-25: the progress row is time | flat 8 px bar | time, monospace ExtraBold 14 (Progressbar.kt:104-165)', () => {
		const row = decls(BAR, '.progress-row');

		expect(row.display).toBe('flex');
		expect(row['justify-content']).toBe('space-between');
		expect(decls(BAR, '.controls').gap).toBe('8px');
		expect(decls(BAR, '.controls')['max-width']).toBeUndefined();

		const time = decls(BAR, '.time');

		expect(time['font-size']).toBe('14px');
		expect(time['font-weight']).toBe('800');
		expect(time['font-family']).toBe('monospace');
		expect(time['min-width']).toBe('48px');
		expect(decls(BAR, '.bar').height).toBe('8px');
		expect(decls(BAR, '.bar').margin).toBe('0 8px');
		expect(decls(BAR, '.fill').background).toBe('var(--cast-text-primary)');
	});

	it('music-25: the end label shows what is left when the account chose remaining (Progressbar.kt:111-117)', () => {
		const wrapper = mount(ProgressControls);

		expect(wrapper.find('.time-end').text()).toBe('3:20');
		syncedSettings.value = { timeChoice: 'remaining' };
		playbackStore.music.applyTime(50000);

		return wrapper.vm.$nextTick().then(() => {
			expect(wrapper.find('.time-end').text()).toBe('2:30');
		});
	});

	it('music-26: the bar holds like, shuffle, previous, play, next, repeat, lyrics, dark mode, in that focus order (FullPlayerScreen.kt:521-573, TvBarControls.kt:33-41)', () => {
		const wrapper = mount(ProgressControls);
		const labels = wrapper.findAll('[data-focusable]').map((b) => b.attributes('aria-label'));

		expect(labels).toEqual([
			'Like',
			'Shuffle',
			'Previous track',
			'Play',
			'Next track',
			'Repeat off',
			'Lyrics',
			'Dark mode',
		]);
	});

	it('music-26: lyrics and dark mode buttons act, the sun shows while dark (TvBarControls.kt:37-41)', async () => {
		const wrapper = mount(ProgressControls);

		await wrapper.find('[aria-label="Dark mode"]').trigger('keydown', { key: 'Enter' });
		expect(settingsStore.tvDarkMode.value).toBe(true);
		expect(wrapper.find('[aria-label="Dark mode"] svg').attributes('data-icon')).toBe('sun');

		await wrapper.find('[aria-label="Lyrics"]').trigger('keydown', { key: 'Enter' });
		expect(playbackStore.music.lyricsOpen.value).toBe(true);
	});
});

describe('the screen matches FullPlayerScreenTV', () => {
	it('music-27: padding is 48 each side, the bar floats 48 above the edge, the title row sits 198 above the bottom (FullPlayerScreen.kt:351, 420, 216)', () => {
		expect(decls(SCREEN, '.content').padding).toBe('0 48px');
		expect(decls(SCREEN, '.bar-wrap').bottom).toBe('48px');
		expect(decls(SCREEN, '.top-row').top).toBe('calc(100% - 198px - 160px)');
		expect(decls(SCREEN, '.now-playing.controls-hidden .top-row').top).toBe('calc(100% - 48px - 120px)');
		expect(decls(SCREEN, '.now-playing.is-lyrics .top-row').top).toBe('32px');
		expect(decls(SCREEN, '.top-row').transition).toBe('top 500ms ease');
	});

	it('music-28: the artist backdrop is the sharp image scaled 1.35 from the top center, no blur (FullPlayerScreen.kt:290-314)', () => {
		const b = decls(SCREEN, '.art-backdrop');

		expect(b.filter).toBeUndefined();
		expect(b.inset).toBe('0');
		expect(b.transform).toBe('scale(1.35)');
		expect(b['transform-origin']).toBe('50% 0');
		expect(b['background-position']).toBe('top center');
		expect(decls(SCREEN, '.now-playing').background).toBe('var(--cast-black)');
	});

	it('music-28: only the track backdrop is drawn, never the cover, and dark mode draws none (FullPlayerScreen.kt:171-179)', () => {
		track({ cover: '/cover.jpg' });
		expect(mount(NowPlayingScreen).find('.art-backdrop').exists()).toBe(false);

		track({ cover: '/cover.jpg', backdrop: '/back.jpg' });
		expect(mount(NowPlayingScreen).find('.art-backdrop').exists()).toBe(true);

		settingsStore.tvDarkMode.value = true;
		expect(mount(NowPlayingScreen).find('.art-backdrop').exists()).toBe(false);
	});

	it('music-29: the scrim runs the ground color at 0.55 to black at 0.85 over a backdrop, opaque without (FullPlayerScreen.kt:321-333)', () => {
		track({ backdrop: '/back.jpg', color_palette: palette });
		const withArt = mount(NowPlayingScreen).find<HTMLElement>('.art-scrim').element.style.background;

		expect(withArt).toContain('0.55');
		expect(withArt).toContain('rgba(0, 0, 0, 0.85)');

		track({ color_palette: palette });
		const plain = mount(NowPlayingScreen).find<HTMLElement>('.art-scrim').element.style.background;

		expect(plain).toContain('rgb(0, 0, 0)');
		expect(plain).not.toContain('0.85');
		expect(plain).not.toContain('0.55');
		expect(decls(SCREEN, '.content').background).toContain('rgba(0, 0, 0, 0.7)');
	});

	it('music-30: like and lyrics left the top row; only close stays (FullPlayerScreen.kt:521, TvBarControls.kt:34)', () => {
		track();
		const wrapper = mount(NowPlayingScreen);
		const top = wrapper.findAll('.utility-row [data-focusable]').map((b) => b.attributes('aria-label'));

		expect(top).toEqual(['Close']);
	});

	it('music-31: after 5 s without input the bar slides out and the title row drops; a key brings them back (FullPlayerScreen.kt:235-242, 414-421)', async () => {
		vi.useFakeTimers();
		track();
		const wrapper = mount(NowPlayingScreen);

		expect(wrapper.find('.bar-wrap').classes()).not.toContain('is-hidden');
		vi.advanceTimersByTime(5100);
		await wrapper.vm.$nextTick();
		expect(wrapper.find('.bar-wrap').classes()).toContain('is-hidden');
		expect(wrapper.find('.now-playing').classes()).toContain('controls-hidden');

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
		await wrapper.vm.$nextTick();
		expect(wrapper.find('.bar-wrap').classes()).not.toContain('is-hidden');
		wrapper.unmount();
	});

	it('music-32: dark mode turns the play button white with a black icon (FullPlayerScreen.kt:553-554)', async () => {
		track();
		settingsStore.tvDarkMode.value = true;
		const wrapper = mount(NowPlayingScreen);

		expect(wrapper.find('.now-playing').classes()).toContain('is-dark');
		expect(decls(SCREEN, '.now-playing.is-dark')['--play-bg']).toBe('var(--cast-white)');
		expect(decls(SCREEN, '.now-playing.is-dark')['--play-fg']).toBe('var(--cast-black)');
		expect(decls(SCREEN, '.now-playing.is-dark')['--color-primary']).toBe('var(--cast-black)');
	});

	it('music-38: a hidden bar leaves the focus order after its slide, and play takes focus 200 ms after it returns (FullPlayerScreen.kt:246-251)', async () => {
		vi.useFakeTimers();
		track();
		const wrapper = mount(NowPlayingScreen, { attachTo: document.body });

		vi.advanceTimersByTime(5100);
		await wrapper.vm.$nextTick();
		expect(decls(SCREEN, '.bar-wrap.is-hidden').visibility).toBe('hidden');
		expect(decls(SCREEN, '.bar-wrap.is-hidden').transition).toContain('visibility 0s linear 300ms');

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
		await wrapper.vm.$nextTick();
		vi.advanceTimersByTime(250);
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Play');
		wrapper.unmount();
	});

	it('music-39: the lyrics layer sits 48 + 60 in from each side (FullPlayerScreen.kt:351, 374)', () => {
		expect(decls(SCREEN, '.lyrics-layer').inset).toBe('60px 108px 0');
	});

	it('music-40: lyrics fade in over 500 ms and out over 300 ms (FullPlayerScreen.kt:356-359)', () => {
		expect(decls(SCREEN, '.lyrics-fade-enter-active').transition).toBe('opacity 500ms ease');
		expect(decls(SCREEN, '.lyrics-fade-leave-active').transition).toBe('opacity 300ms ease');
		expect(decls(SCREEN, '.lyrics-fade-enter-from').opacity).toBe('0');
	});

	it('music-41: the close button has no dead border: 0 line', () => {
		const source = readFileSync(resolve(__dirname, '../../views/now-playing/NowPlayingScreen.vue'), 'utf8');

		expect(source).not.toMatch(/border:\s*0;/);
	});
});
