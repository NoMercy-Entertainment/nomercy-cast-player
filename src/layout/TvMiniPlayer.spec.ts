import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import TvMiniPlayer from './TvMiniPlayer.vue';
import { playbackStore } from '@/stores/playbackStore';
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
});
