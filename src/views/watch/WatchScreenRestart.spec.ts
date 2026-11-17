// A second cast while a title plays pushes a new watch route onto the same
// component. The player must start the new item, not keep the old one.

import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import WatchScreen from './WatchScreen.vue';

Element.prototype.scrollIntoView = vi.fn();

const { mounted } = vi.hoisted(() => ({ mounted: vi.fn() }));

vi.mock('@/queries/usePlaylistQuery', () => ({
	usePlaylistQuery: () => ({
		data: ref({ playlist: [{ id: 1 }], item: { id: 1 } }),
		isLoading: ref(false),
		error: ref(null),
		refetch: vi.fn(),
	}),
}));

vi.mock('@tanstack/vue-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/players/video/VideoPlayer.vue', () => ({
	default: {
		name: 'VideoPlayer',
		props: ['initialItem', 'resumeAt', 'isCast'],
		template: '<div />',
		mounted: () => mounted(),
	},
}));

describe('a new watch route restarts the player', () => {
	it('mounts a fresh player when the route changes from episode 2 to episode 3', async () => {
		const router = createRouter({
			history: createMemoryHistory(),
			routes: [{
				path: '/tv/:id/watch',
				component: WatchScreen,
				props: (route) => ({ type: 'tv', id: route.params.id }),
			}],
		});

		await router.push('/tv/1/watch?episode=2');
		await router.isReady();

		const wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] } });

		await flushPromises();
		expect(mounted).toHaveBeenCalledTimes(1);

		await router.push('/tv/1/watch?episode=3&cast=true');
		await flushPromises();

		expect(mounted).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});
});
