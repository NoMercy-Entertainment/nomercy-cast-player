import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import MusicListScreen from './MusicListScreen.vue';

const state = vi.hoisted(() => ({ refetch: vi.fn() }));

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: { type: 'album', id: 'alb-1' } }),
	useRouter: () => ({ push: vi.fn() }),
}));

const error = ref<Error | null>(null);

vi.mock('@/queries/useMusicListQuery', () => ({
	useMusicListQuery: () => ({
		data: ref(undefined),
		isLoading: ref(false),
		error,
		refetch: state.refetch,
	}),
}));

Element.prototype.scrollIntoView = vi.fn();

describe('a music list that fails to load', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		error.value = null;
		state.refetch.mockClear();
	});

	it('never shows the error panel for a canceled request', async () => {
		error.value = new DOMException('The user aborted a request.', 'AbortError');

		const wrapper = mount(MusicListScreen);

		await nextTick();

		expect(wrapper.text()).not.toContain('aborted');
		expect(wrapper.text()).not.toContain('Couldn\'t load this list');
		wrapper.unmount();
	});

	it('tries again by itself every 15 seconds, like the other music pages', async () => {
		const wrapper = mount(MusicListScreen);

		error.value = new Error('Request timed out');
		await nextTick();
		vi.advanceTimersByTime(15_001);

		expect(state.refetch).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});
});
