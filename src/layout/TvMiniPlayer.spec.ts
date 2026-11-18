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
});
