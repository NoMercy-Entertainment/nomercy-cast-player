import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { Ref } from 'vue';
import SearchScreen from './SearchScreen.vue';
import SearchKeyboard from './SearchKeyboard.vue';
import type { Component } from '@/server-components/types';

const state = vi.hoisted(() => ({
	data: undefined as unknown,
	error: null as unknown,
	seen: [] as string[],
}));

vi.mock('@/queries/useSearchQuery', () => ({
	useSearchQuery: (_type: Ref<string>, query: Ref<string>) => ({
		get data() {
			state.seen.push(query.value);

			return ref(state.data);
		},
		isLoading: ref(false),
		isFetching: ref(false),
		error: ref(state.error),
		refetch: vi.fn(),
	}),
}));

const emptyGrid = {
	id: 'g1',
	component: 'NMGrid',
	props: { id: 'g1', items: [] },
} as unknown as Component;
const unknown = {
	id: 'u1',
	component: 'NMMadeUp',
	props: { id: 'u1' },
} as unknown as Component;
const filledGrid = {
	id: 'g2',
	component: 'NMGrid',
	props: { id: 'g2', items: [{
		id: 'c1',
		component: 'NMCard',
		props: { id: 'c1' },
	}] },
} as unknown as Component;

// SearchViewModel.kt:29-32 waits 1250 ms and drops anything under 3 characters.
describe('search debounce matches the native SearchViewModel', () => {
	Element.prototype.scrollIntoView = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
		state.data = undefined;
		state.error = null;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const lastQuery = () => {
		const wrapper = mount(SearchScreen);

		return wrapper;
	};

	it('does not search until 1250 ms after the last key', async () => {
		const wrapper = lastQuery();
		const kb = wrapper.findComponent(SearchKeyboard);

		for (const letter of ['k', 'e', 'y']) {
			kb.vm.$emit('type', letter);
			await wrapper.vm.$nextTick();
			vi.advanceTimersByTime(300);
		}

		state.seen.length = 0;
		vi.advanceTimersByTime(900);
		await wrapper.vm.$nextTick();
		await wrapper.vm.$nextTick();
		expect(wrapper.get('.results').text()).toBe('');
		expect((wrapper.vm as unknown as { debouncedQuery: string }).debouncedQuery).toBe('');

		vi.advanceTimersByTime(60);
		await wrapper.vm.$nextTick();
		expect((wrapper.vm as unknown as { debouncedQuery: string }).debouncedQuery).toBe('key');
	});

	it('keeps a query of one or two characters out of the search', async () => {
		const wrapper = lastQuery();
		const kb = wrapper.findComponent(SearchKeyboard);

		kb.vm.$emit('type', 'a');
		kb.vm.$emit('type', 'b');
		await wrapper.vm.$nextTick();
		vi.advanceTimersByTime(1300);
		await wrapper.vm.$nextTick();

		expect((wrapper.vm as unknown as { debouncedQuery: string }).debouncedQuery).toBe('');
	});

	it('searches three spaces, as the native length check does', async () => {
		const wrapper = lastQuery();
		const kb = wrapper.findComponent(SearchKeyboard);

		for (let i = 0; i < 3; i++) {
			kb.vm.$emit('space');
		}

		await wrapper.vm.$nextTick();
		vi.advanceTimersByTime(1300);
		await wrapper.vm.$nextTick();

		expect((wrapper.vm as unknown as { debouncedQuery: string }).debouncedQuery).toBe('   ');
	});
});

// SearchScreen.kt:121-148 filters with hasContent and checks data before the error.
describe('the results area draws what the native SearchScreen draws', () => {
	Element.prototype.scrollIntoView = vi.fn();

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		state.data = undefined;
		state.error = null;
	});

	const typed = async () => {
		const wrapper = mount(SearchScreen);

		for (const letter of ['z', 'z', 'z']) {
			wrapper.findComponent(SearchKeyboard).vm.$emit('type', letter);
		}

		await wrapper.vm.$nextTick();
		vi.advanceTimersByTime(1300);
		await wrapper.vm.$nextTick();

		return wrapper;
	};

	it('draws nothing for an empty grid and an unknown component', async () => {
		state.data = [emptyGrid, unknown];
		const wrapper = await typed();

		expect(wrapper.findAll('.results > *')).toHaveLength(0);
	});

	it('draws the components that have content', async () => {
		state.data = [emptyGrid, filledGrid];
		const wrapper = await typed();

		expect(wrapper.findAll('.results > *')).toHaveLength(1);
	});

	it('keeps cached results on screen when a refetch fails', async () => {
		state.data = [filledGrid];
		state.error = new Error('Network request failed');
		const wrapper = await typed();

		expect(wrapper.text()).not.toContain('Network request failed');
		expect(wrapper.findAll('.results > *')).toHaveLength(1);
	});

	it('draws no refreshing hint', async () => {
		state.data = [filledGrid];
		const wrapper = await typed();

		expect(wrapper.find('.refresh-hint').exists()).toBe(false);
	});
});
