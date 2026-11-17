import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SearchScreen from './SearchScreen.vue';
import SearchKeyboard from './SearchKeyboard.vue';

const state = vi.hoisted(() => ({ loading: false }));

vi.mock('@/queries/useSearchQuery', () => ({
	useSearchQuery: () => ({
		data: ref(undefined),
		isLoading: ref(state.loading),
		isFetching: ref(false),
		error: ref(null),
		refetch: vi.fn(),
	}),
}));

// SearchScreen.kt:96-125 draws results, a spinner or an error card, and nothing else.
describe('the results area draws only what the native SearchScreen draws', () => {
	Element.prototype.scrollIntoView = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		state.loading = false;
	});

	const type = async (letters: string[]) => {
		const wrapper = mount(SearchScreen);

		letters.forEach((letter) => wrapper.findComponent(SearchKeyboard).vm.$emit('type', letter));

		await wrapper.vm.$nextTick();
		vi.advanceTimersByTime(300);
		await wrapper.vm.$nextTick();

		return wrapper;
	};

	// SearchScreen.kt:60 requests focus on the A key as soon as the screen is composed.
	it('puts focus on the A key when the screen opens, even from the top nav', async () => {
		const nav = document.createElement('a');

		nav.href = '#nav';
		document.body.append(nav);
		nav.focus();
		const wrapper = mount(SearchScreen, { attachTo: document.body });

		await wrapper.vm.$nextTick();

		expect(document.activeElement?.textContent?.trim()).toBe('a');
		wrapper.unmount();
	});

	it('says nothing before anything is typed', () => {
		const wrapper = mount(SearchScreen);

		expect(wrapper.get('.results').text()).toBe('');
	});

	it('says nothing when the search found nothing', async () => {
		const wrapper = await type(['z', 'z', 'z']);

		expect(wrapper.get('.results').text()).toBe('');
	});

	it('draws the spinner while loading, not skeleton rails', async () => {
		state.loading = true;
		const wrapper = await type(['z', 'z', 'z']);

		expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
	});
});
