import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import TopNavBar from './TopNavBar.vue';
import { focusTopnav } from '@/composables/useNavFocusBridge';
import { playbackStore } from '@/stores/playbackStore';
import type { CurrentTrackSnapshot } from '@/stores/playbackStore';

const route = { path: '/libraries' };

// jsdom has no layout, so it has no scrollIntoView; focusing a nav item calls it.
Element.prototype.scrollIntoView = vi.fn();

vi.mock('vue-router', () => ({
	useRoute: () => route,
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/queries/useMeQuery', () => ({
	useMeQuery: () => ({ data: { value: { name: 'Jordan', email: 'jordan@example.com' } } }),
}));

afterEach(() => {
	playbackStore.music.applyTrack(null, []);
	document.body.innerHTML = '';
});

describe('the mini player replaces the logo (TvNavigationBar.kt:156-173)', () => {
	it('draws the logo when no song plays (positive control)', () => {
		const wrapper = mount(TopNavBar);

		expect(wrapper.find('.brand-logo').exists()).toBe(true);
		expect(wrapper.find('.mini-player').exists()).toBe(false);
	});

	it('draws no logo while a song plays', async () => {
		playbackStore.music.applyTrack({
			id: 't1',
			name: 'Song',
			artist: 'Artist',
		} as CurrentTrackSnapshot, []);

		const wrapper = mount(TopNavBar);

		await flushPromises();

		expect(wrapper.find('.brand-logo').exists()).toBe(false);
	});
});

describe('up from the top row lands on the active tab (TvNavigationBar.kt:111-131)', () => {
	it('focuses the nav item of the current page, not Home', async () => {
		const wrapper = mount(TopNavBar, { attachTo: document.body });

		await flushPromises();

		expect(focusTopnav()).toBe(true);

		const libraries = wrapper.find('.nav-link.active').element;

		expect(document.activeElement).toBe(libraries);
		expect(libraries.textContent).toContain('Libraries');
		wrapper.unmount();
	});
});
