import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import MusicListScreen from './MusicListScreen.vue';
import { socketStore } from '@/stores/socketStore';

const push = vi.fn();

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: { type: 'album', id: 'alb-1' } }),
	useRouter: () => ({ push }),
}));

const listData = ref({
	id: 'alb-1',
	title: 'Test Album',
	tracks: [
		{ id: 'trk-1', title: 'Track One' },
	],
});

vi.mock('@/queries/useMusicListQuery', () => ({
	useMusicListQuery: () => ({
		data: listData,
		isLoading: ref(false),
		error: ref(null),
		refetch: vi.fn(),
	}),
}));

function screen(): ReturnType<typeof mount> {
	return mount(MusicListScreen);
}

describe('pressing Play only opens Now Playing once playback actually starts', () => {
	beforeEach(() => {
		push.mockClear();
	});

	afterEach(() => {
		socketStore.musicHub.value = null;
	});

	it('does not navigate to Now Playing when the music hub is down', async () => {
		socketStore.musicHub.value = null;

		const wrapper = screen();
		await wrapper.find('[aria-label="Play"]').trigger('click');
		await flushPromises();

		expect(push).not.toHaveBeenCalledWith('/now-playing');
	});

	it('navigates to Now Playing once the start command succeeds', async () => {
		socketStore.musicHub.value = {
			invoke: vi.fn(async () => undefined),
		} as unknown as typeof socketStore.musicHub.value;

		const wrapper = screen();
		await wrapper.find('[aria-label="Play"]').trigger('click');
		await flushPromises();

		expect(push).toHaveBeenCalledWith('/now-playing');
	});
});

function flushPromises(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}
