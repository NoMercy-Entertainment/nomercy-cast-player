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
	playlistItem: vi.fn(),
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

	it('starts on the cast item, not on the first playlist item, once the playlist loads', async () => {
		setupMock.mockClear();
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const router = createRouter({
			history: createWebHistory(),
			routes: [{ path: '/', component: { template: '<div />' } }],
		});

		const items = ['e1', 'e2', 'e3'].map(id => ({ id, title: id, duration: 100, file: `https://example.invalid/${id}.m3u8` }));
		const wrapper = mount(VideoPlayer, {
			props: { type: 'tv', id: '1', playlist: items, initialItem: items[2] },
			global: { plugins: [router] },
		});
		await flushPromises();

		expect(setupMock).toHaveBeenCalledWith(expect.objectContaining({ language: expect.any(String) }));
		const player = setupMock.mock.results[0].value;
		const onPlaylist = [...player.on.mock.calls, ...player.once.mock.calls]
			.find(([event]) => event === 'playlist')?.[1] as (() => void) | undefined;
		expect(onPlaylist).toBeTypeOf('function');
		onPlaylist!();
		expect(player.playlistItem).toHaveBeenCalledWith(2);

		wrapper.unmount();
	});

	it('starts with the account\'s subtitle and audio language, the choice the phone synced', async () => {
		setupMock.mockClear();
		const { authStore } = await import('@/stores/authStore');
		authStore.defaultSubtitleLanguage.value = 'eng';
		authStore.defaultAudioLanguage.value = 'jpn';
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const router = createRouter({
			history: createWebHistory(),
			routes: [{ path: '/', component: { template: '<div />' } }],
		});

		const item = { id: '1', title: 'One', duration: 100, file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: { type: 'movie', id: '1', playlist: [item], initialItem: item },
			global: { plugins: [router] },
		});
		await flushPromises();

		expect(setupMock).toHaveBeenCalledWith(expect.objectContaining({
			defaultSubtitleLanguage: 'eng',
			defaultAudioLanguage: 'jpn',
		}));

		authStore.defaultSubtitleLanguage.value = null;
		authStore.defaultAudioLanguage.value = null;
		wrapper.unmount();
	});

	it('starts with the subtitle and audio the phone showed, as the player\'s stored pick', async () => {
		setupMock.mockClear();
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const router = createRouter({
			history: createWebHistory(),
			routes: [{ path: '/', component: { template: '<div />' } }],
		});

		const item = { id: '1', title: 'One', duration: 100, file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: {
				type: 'tv',
				id: '1',
				playlist: [item],
				initialItem: item,
				castAudioLanguage: 'eng',
				castSubtitle: { language: 'eng', type: 'full', format: 'ass' },
			},
			global: { plugins: [router] },
		});
		await flushPromises();

		const options = setupMock.mock.calls[0][0] as { storage?: { get: (key: string) => unknown } };
		expect(JSON.parse(String(options.storage?.get('nmplayer-language-subtitle'))))
			.toEqual({ language: 'eng', type: 'full', format: 'ass', explicit: true });
		expect(options.storage?.get('nmplayer-language-audio')).toBe('eng');

		wrapper.unmount();
	});
});
