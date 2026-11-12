import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import WatchScreen from './WatchScreen.vue';
import { authStore } from '@/stores/authStore';

const data = ref<{ playlist: unknown[]; item?: unknown } | undefined>(undefined);
const isLoading = ref(false);
const error = ref<Error | null>(null);
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }));

vi.mock('@/queries/usePlaylistQuery', () => ({
	usePlaylistQuery: () => ({
		data,
		isLoading,
		error,
		refetch: vi.fn(),
	}),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: routeQuery.value }),
}));

vi.mock('@tanstack/vue-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/players/video/VideoPlayer.vue', () => ({
	default: {
		name: 'VideoPlayer',
		props: ['initialItem', 'resumeAt'],
		template: '<div />',
		emits: ['error'],
		mounted(this: { $emit: (event: string, message: string) => void }) {
			this.$emit('error', 'The video player could not start.');
		},
	},
}));

describe('the watch screen does not go black when there is nothing to play', () => {
	it('starts the requested episode before applying the resume position', () => {
		routeQuery.value = { season: '1', episode: '3', resume_at: '90' };
		data.value = { playlist: [{ id: 1, season: 1, episode: 1 }, { id: 3, season: 1, episode: 3 }], item: { id: 1, season: 1, episode: 1 } };
		const wrapper = mount(WatchScreen, { props: { type: 'tv', id: '42' } });
		expect(wrapper.findComponent({ name: 'VideoPlayer' }).props()).toMatchObject({ initialItem: { id: 3, season: 1, episode: 3 }, resumeAt: 90 });
		routeQuery.value = {};
	});
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

describe('the watch screen says to cast again when the sender sends no fresh token', () => {
	afterEach(() => {
		authStore.clear();
		vi.useRealTimers();
	});

	it('shows the cast-again panel 10 seconds after the renewal request, not before', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const exp = Math.floor(Date.now() / 1000) + 60;
		const token = `header.${btoa(JSON.stringify({ sub: 'made-up-user', exp }))}.signature`;
		authStore.consumeRealHandshake(token, {
			serverId: 'made-up-server',
			serverUrl: 'https://example.test',
			defaultSubtitleLanguage: null,
			defaultAudioLanguage: null,
		});
		data.value = { playlist: [{ id: 1 }], item: { id: 1, title: 'Test' } };
		isLoading.value = false;
		error.value = null;
		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' } });

		vi.advanceTimersByTime(30_000);
		expect(authStore.renewalRequired.value).toBe(true);

		vi.advanceTimersByTime(9_900);
		await nextTick();
		expect(wrapper.text()).not.toContain('Cast again from your phone');

		vi.advanceTimersByTime(100);
		await nextTick();
		expect(wrapper.text()).toContain('Your sign-in on this TV is ending. Cast again from your phone to keep watching.');
		expect(wrapper.find('button').text()).toContain('Try again');
	});
});
