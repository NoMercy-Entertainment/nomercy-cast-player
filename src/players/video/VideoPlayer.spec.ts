import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';

const setupMock = vi.fn((options: unknown) => ({
	options,
	playlist: () => (options as { playlist?: unknown[] }).playlist ?? [],
	on: vi.fn(),
	off: vi.fn(),
	play: vi.fn(),
	pause: vi.fn(),
	seek: vi.fn(),
	dispose: vi.fn(),
	once: vi.fn(),
}));
const factory = vi.fn(() => ({ setup: setupMock }));

vi.mock('@nomercy-entertainment/nomercy-video-player', () => ({
	default: factory,
}));

describe('videoPlayer starts the cast watch session', () => {
	it('configures the player via setup() with the playlist, instead of calling loadPlaylist with ignored arguments', async () => {
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const router = createRouter({
			history: createWebHistory(),
			routes: [{ path: '/', component: { template: '<div />' } }],
		});

		const item = { id: '1', title: 'One', duration: 100, file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: {
				type: 'movie',
				id: '1',
				playlist: [item],
				initialItem: item,
			},
			global: { plugins: [router] },
		});

		await flushPromises();

		expect(setupMock).toHaveBeenCalledWith(expect.objectContaining({
			playlist: [item],
			autoPlay: true,
			isTv: true,
		}));
		expect(setupMock.mock.results[0].value.playlist()).toHaveLength(1);

		wrapper.unmount();
	});
});
