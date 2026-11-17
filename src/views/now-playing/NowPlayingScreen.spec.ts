// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import NowPlayingScreen from './NowPlayingScreen.vue';
import { playbackStore } from '@/stores/playbackStore';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

// jsdom has no layout, so it has no scrollIntoView; focusing an entry calls it.
Element.prototype.scrollIntoView = vi.fn();

function flushPromises(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('the full player matches FullPlayerScreen.kt', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		playbackStore.music.applyLyricsOpen(false);
	});

	it('music-10: the play button holds focus when the player opens', async () => {
		playbackStore.music.applyTrack({
			id: 't1',
			name: 'Song',
			artist: 'Band',
		} as never, []);

		const wrapper = mount(NowPlayingScreen, { attachTo: document.body });

		await flushPromises();
		await flushPromises();

		expect(document.activeElement?.getAttribute('aria-label')).toBe('Play');
		wrapper.unmount();
	});

	it('music-14: lyrics keep the title and artwork on screen instead of hiding them', async () => {
		playbackStore.music.applyTrack({
			id: 't1',
			name: 'Song',
			artist: 'Band',
		} as never, []);

		playbackStore.music.applyLyricsOpen(true);

		const wrapper = mount(NowPlayingScreen);

		await flushPromises();

		const hero = wrapper.find('.hero');

		expect(hero.exists()).toBe(true);
		expect(hero.attributes('style') ?? '').not.toContain('display: none');
		expect(hero.classes()).toContain('is-compact');
	});
});
