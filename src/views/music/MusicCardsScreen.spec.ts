import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import MusicCardsScreen from './MusicCardsScreen.vue';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: { pathMatch: ['artists'] } }),
}));

vi.mock('@/queries/useMusicCardQuery', () => ({
	useMusicCardQuery: () => ({
		data: ref([]),
		isLoading: ref(false),
		isFetching: ref(false),
		error: ref(null),
		refetch: vi.fn(),
	}),
}));

describe('the music cards page is the same rows template as the music start page', () => {
	Element.prototype.scrollIntoView = vi.fn();

	it('draws through the hero-and-rails scaffold, like TvLolomoScreen for both pages', () => {
		const wrapper = mount(MusicCardsScreen);

		expect(wrapper.find('.nm-hero-rails-screen').exists()).toBe(true);
		expect(wrapper.find('.server-driven').exists()).toBe(false);
	});
});
