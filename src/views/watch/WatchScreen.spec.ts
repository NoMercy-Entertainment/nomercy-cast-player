import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import WatchScreen from './WatchScreen.vue';

const data = ref<{ playlist: unknown[]; item?: unknown } | undefined>(undefined);
const isLoading = ref(false);
const error = ref<Error | null>(null);

vi.mock('@/queries/usePlaylistQuery', () => ({
	usePlaylistQuery: () => ({
		data,
		isLoading,
		error,
		refetch: vi.fn(),
	}),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: {} }),
}));

vi.mock('@tanstack/vue-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/players/video/VideoPlayer.vue', () => ({
	default: {
		name: 'VideoPlayer',
		template: '<div />',
		emits: ['error'],
		mounted(this: { $emit: (event: string, message: string) => void }) {
			this.$emit('error', 'The video player could not start.');
		},
	},
}));

describe('the watch screen does not go black when there is nothing to play', () => {
	it('shows an error panel instead of a blank screen when the playlist has no item', () => {
		data.value = { playlist: [] };
		isLoading.value = false;
		error.value = null;

		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' } });

		expect(wrapper.text()).toContain('Nothing to play');
	});

	it('shows an error panel instead of a blank screen when the player fails to init', async () => {
		data.value = { playlist: [{ id: 1 }], item: { id: 1, title: 'Test' } };
		isLoading.value = false;
		error.value = null;

		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' } });
		await nextTick();

		expect(wrapper.text()).toContain('could not start');
	});
});
