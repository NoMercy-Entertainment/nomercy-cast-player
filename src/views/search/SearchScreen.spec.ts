import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SearchScreen from './SearchScreen.vue';
import SearchKeyboard from './SearchKeyboard.vue';

vi.mock('@/queries/useSearchQuery', () => ({
	useSearchQuery: () => ({
		data: ref(undefined),
		isLoading: ref(false),
		isFetching: ref(false),
		error: ref(new Error('Network request failed')),
		refetch: vi.fn(),
	}),
}));

describe('the search bar matches the native SearchBar', () => {
	Element.prototype.scrollIntoView = vi.fn();

	it('shows the magnifier and the placeholder of the mode, with no label, caret glyph or mode pill', async () => {
		const wrapper = mount(SearchScreen);
		const bar = wrapper.get('.query-bar');

		expect(bar.find('svg.moooom-icon').attributes('data-icon')).toBe('searchMagnifyingGlass');
		expect(bar.text()).toBe('Movie, show or person…');

		wrapper.findComponent(SearchKeyboard).vm.$emit('mode', 'music');
		await wrapper.vm.$nextTick();

		expect(bar.text()).toBe('Song, album or artist…');
	});

	it('shows the typed text instead of the placeholder', async () => {
		const wrapper = mount(SearchScreen);

		wrapper.findComponent(SearchKeyboard).vm.$emit('type', 'a');
		await wrapper.vm.$nextTick();

		expect(wrapper.get('.query-bar').text()).toBe('a');
	});
});

describe('search when the search request fails', () => {
	// jsdom has no layout, so it has no scrollIntoView.
	Element.prototype.scrollIntoView = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows an error instead of claiming there are no results', async () => {
		const wrapper = mount(SearchScreen);

		for (const letter of ['f', 'a', 'i', 'l']) {
			wrapper.findComponent(SearchKeyboard).vm.$emit('type', letter);
		}

		await wrapper.vm.$nextTick();

		vi.advanceTimersByTime(1300);
		await wrapper.vm.$nextTick();

		const text = wrapper.text();

		expect(text).not.toContain('No results');
		expect(text).toContain('Network request failed');
	});
});
