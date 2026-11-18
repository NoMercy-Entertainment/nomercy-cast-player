import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import TvMiniPlayer from './TvMiniPlayer.vue';
import { playbackStore } from '@/stores/playbackStore';
import { settingsStore } from '@/stores/settingsStore';
import { pickPaletteColor } from '@/lib/images/urls';
import { decls } from '@/test/cssDecl';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

describe('the mini player matches MiniPlayer.kt', () => {
	it('music-17: the circle holds the equalizer or the play icon and never the cover image', () => {
		playbackStore.music.applyTrack({
			id: 't1',
			name: 'Song',
			artist: 'Band',
			cover: '/cover.jpg',
		} as never, []);

		playbackStore.music.applyPlayState(false);

		const wrapper = mount(TvMiniPlayer);

		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.find('.play-icon').exists()).toBe(true);
	});

	it('music-17: the pill is 360 wide and the title is Medium 10 (MiniPlayer.kt:120, :212-214)', () => {
		expect(decls('layout/TvMiniPlayer.vue', '.mini-player').width).toBe('360px');
		expect(decls('layout/TvMiniPlayer.vue', '.title')['font-weight']).toBe('500');
	});

	const palette = { cover: { dominant: '#AA2244', darkVibrant: '#661122' } };

	// MiniPlayer.kt:63-70: the song's own palette (cover, image, backdrop, profile), dark 20 light 160,
	// never the focused card's accent; the theme color when auto colors are off.
	it('music-18: the pill takes the song palette at 40 percent, or the theme color with auto colors off', () => {
		settingsStore.useAutoThemeColors.value = true;

		playbackStore.music.applyTrack({
			id: 't2',
			name: 'My Religion',
			artist: 'Pulser',
			color_palette: palette,
		} as never, []);

		const wrapper = mount(TvMiniPlayer);
		const pill = wrapper.find<HTMLElement>('.mini-player').element;

		expect(pill.style.getPropertyValue('--mini-color')).toBe(pickPaletteColor(palette.cover, 20, 160));

		settingsStore.useAutoThemeColors.value = false;

		return wrapper.vm.$nextTick().then(() => {
			expect(pill.style.getPropertyValue('--mini-color')).toBe('');
		});
	});

	// MiniPlayer.kt:98-105,174-186: color 40% to black 40% (a solid gradient on a 40% layer, as Chrome 92
	// has no color-mix); the circle has the same gradient turned -95 deg and a 20 dp play icon, no dark disc.
	it('music-18: the pill and its circle draw the color gradient and a 20 px play icon', () => {
		const pill = decls('layout/TvMiniPlayer.vue', '.mini-player::before');
		const circle = decls('layout/TvMiniPlayer.vue', '.art::before');

		expect(pill.background).toContain('180deg, var(--mini-color, var(--color-primary');
		expect(pill.opacity).toBe('0.4');
		expect(circle.background).toContain('85deg, var(--mini-color, var(--color-primary');
		expect(circle.opacity).toBe('0.4');

		settingsStore.useAutoThemeColors.value = true;

		playbackStore.music.applyTrack({
			id: 't3',
			name: 'Song',
			color_palette: palette,
		} as never, []);

		playbackStore.music.applyPlayState(false);

		const icon = mount(TvMiniPlayer).find('.play-icon');

		expect(icon.attributes('width')).toBe('20');
		expect(decls('layout/TvMiniPlayer.vue', '.play-icon').background).toBeUndefined();
	});

	// EqSpinner.kt:24-27: five bars, 2 wide, 1 apart, in a 16 high box, the theme color (MiniPlayer.kt:193).
	it('music-33: the equalizer is five 2 px bars 1 px apart in a 16 px box', () => {
		playbackStore.music.applyPlayState(true);
		const wrapper = mount(TvMiniPlayer);

		expect(wrapper.findAll('.eq span')).toHaveLength(5);
		expect(decls('layout/TvMiniPlayer.vue', '.eq span').width).toBe('2px');
		expect(decls('layout/TvMiniPlayer.vue', '.eq span').background).toBe('var(--color-primary)');
		expect(decls('layout/TvMiniPlayer.vue', '.eq').gap).toBe('1px');
		expect(decls('layout/TvMiniPlayer.vue', '.eq').height).toBe('16px');
	});

	// MiniPlayer.kt:117-167, :206-208: no end padding, the text column fills the rest and spaces evenly.
	it('music-34: the pill has no end padding and the text column fills the rest, evenly spaced', () => {
		const pill = decls('layout/TvMiniPlayer.vue', '.mini-player');
		const meta = decls('layout/TvMiniPlayer.vue', '.meta');

		expect(pill.padding).toBeUndefined();
		expect(meta.flex).toBe('1 1 0');
		expect(meta.display).toBe('flex');
		expect(meta['justify-content']).toBe('space-evenly');
		expect(decls('layout/TvMiniPlayer.vue', '.title')['max-width']).toBeUndefined();
		expect(decls('layout/TvMiniPlayer.vue', '.artist')['max-width']).toBeUndefined();
	});

	// TrackLinks.kt:44-46: labelSmall (11) Medium at 0.7 alpha; MiniPlayer.kt:220: in a Marquee.
	it('music-35: the artist line is 11 px Medium at 0.7 alpha', () => {
		const a = decls('layout/TvMiniPlayer.vue', '.artist');

		expect(a['font-size']).toBe('11px');
		expect(a['font-weight']).toBe('500');
		expect(a.color).toBe('oklch(1 0 0 / 0.7)');
		expect(a.margin).toBeUndefined();
	});

	// Marquee.kt:30-67: pause 1.5 s, scroll 5 s, pause 1.5 s, fade out 0.5 s, reset, fade in 0.5 s;
	// the scroll is the overflow plus the 16 dp end padding plus 16 dp of scroll padding.
	it('music-36: an artist line wider than its box scrolls as a marquee over 9 s, a short one stays still', async () => {
		const widths = { text: 300 };
		const proto = HTMLElement.prototype;
		const offset = Object.getOwnPropertyDescriptor(proto, 'offsetWidth');
		const client = Object.getOwnPropertyDescriptor(proto, 'clientWidth');

		Object.defineProperty(proto, 'offsetWidth', {
			configurable: true,
			get(this: HTMLElement) {
				return this.classList.contains('artist-text') ? widths.text : 0;
			},
		});

		Object.defineProperty(proto, 'clientWidth', {
			configurable: true,
			get(this: HTMLElement) {
				return this.classList.contains('artist') ? 200 : 0;
			},
		});

		try {
			const wrapper = mount(TvMiniPlayer);

			await wrapper.vm.$nextTick();
			expect(wrapper.find('.artist').classes()).toContain('is-marquee');
			expect(wrapper.find<HTMLElement>('.artist').element.style.getPropertyValue('--marquee-shift')).toBe('-132px');
			expect(decls('layout/TvMiniPlayer.vue', '.artist.is-marquee .artist-text').animation).toContain('9000ms');

			widths.text = 100;
			const short = mount(TvMiniPlayer);

			await short.vm.$nextTick();
			expect(short.find('.artist').classes()).not.toContain('is-marquee');
		} finally {
			if (offset) Object.defineProperty(proto, 'offsetWidth', offset);
			if (client) Object.defineProperty(proto, 'clientWidth', client);
		}
	});
});
