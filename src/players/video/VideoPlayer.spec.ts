import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';

type Handler = (data?: unknown) => void;

// The 2.x surface the receiver uses: factory(id) returns the player before
// setup(), plugins register on it, and setup(config) returns it.
function makePlayer() {
	let items: Array<{ id: string }> = [];
	let current = 0;
	let duration = 0;
	const handlers = new Map<string, Handler[]>();
	const player = {
		options: undefined as unknown,
		container: document.createElement('div'),
		addPlugin: vi.fn(() => player),
		setup: vi.fn((options: { playlist?: Array<{ id: string }> }) => {
			player.options = options;
			items = options.playlist ?? [];
			return player;
		}),
		queue: vi.fn((next?: Array<{ id: string }>) => {
			if (next)
				items = next;
			return items;
		}),
		item: vi.fn(() => items[current]),
		index: vi.fn(() => current),
		seekToIndex: vi.fn((position: number) => { current = position; }),
		time: vi.fn(),
		chapters: vi.fn(() => []),
		audioTrack: vi.fn(() => null),
		subtitle: vi.fn(() => null),
		duration: vi.fn(() => duration),
		setDuration: (value: number) => { duration = value; },
		on: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		}),
		off: vi.fn(),
		once: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		}),
		fire: (event: string, data?: unknown) => {
			for (const handler of handlers.get(event) ?? [])
				handler(data);
		},
		play: vi.fn(),
		pause: vi.fn(),
		dispose: vi.fn(async () => {}),
	};
	return player;
}

const players: Array<ReturnType<typeof makePlayer>> = [];
const factory = vi.fn(() => {
	const player = makePlayer();
	players.push(player);
	return player;
});
class OctopusPlugin {}
class SubtitleOverlayPlugin {}

vi.mock('@nomercy-entertainment/nomercy-video-player', () => ({
	default: factory,
	OctopusPlugin,
}));
vi.mock('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay', () => ({
	SubtitleOverlayPlugin,
}));

function router() {
	return createRouter({
		history: createWebHistory(),
		routes: [{ path: '/', component: { template: '<div />' } }],
	});
}

describe('videoPlayer starts the cast watch session', () => {
	it('configures the player via setup() with the playlist, instead of calling loadPlaylist with ignored arguments', async () => {
		players.length = 0;
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;

		const item = { id: '1', title: 'One', duration: 100, file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: {
				type: 'movie',
				id: '1',
				playlist: [item],
				initialItem: item,
			},
			global: { plugins: [router()] },
		});

		await flushPromises();

		const player = players[0]!;
		expect(player.setup).toHaveBeenCalledWith(expect.objectContaining({
			playlist: [item],
			autoPlay: true,
		}));
		expect(player.queue()).toHaveLength(1);

		wrapper.unmount();
	});

	it('starts on the cast item, not on the first playlist item, once the queue loads', async () => {
		players.length = 0;
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;

		const items = ['e1', 'e2', 'e3'].map(id => ({ id, title: id, duration: 100, file: `https://example.invalid/${id}.m3u8` }));
		const wrapper = mount(VideoPlayer, {
			props: { type: 'tv', id: '1', playlist: items, initialItem: items[2] },
			global: { plugins: [router()] },
		});
		await flushPromises();

		const player = players[0]!;
		expect(player.setup).toHaveBeenCalledWith(expect.objectContaining({ language: expect.any(String) }));
		const onQueue = player.once.mock.calls.find(([event]) => event === 'queue')?.[1] as (() => void) | undefined;
		expect(onQueue).toBeTypeOf('function');
		onQueue!();
		expect(player.seekToIndex).toHaveBeenCalledWith(2);

		wrapper.unmount();
	});

	it('starts with the account\'s subtitle and audio language, the choice the phone synced', async () => {
		players.length = 0;
		const { authStore } = await import('@/stores/authStore');
		authStore.defaultSubtitleLanguage.value = 'eng';
		authStore.defaultAudioLanguage.value = 'jpn';
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;

		const item = { id: '1', title: 'One', duration: 100, file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: { type: 'movie', id: '1', playlist: [item], initialItem: item },
			global: { plugins: [router()] },
		});
		await flushPromises();

		expect(players[0]!.setup).toHaveBeenCalledWith(expect.objectContaining({
			defaultSubtitleLanguage: 'eng',
			defaultAudioLanguage: 'jpn',
		}));

		authStore.defaultSubtitleLanguage.value = null;
		authStore.defaultAudioLanguage.value = null;
		wrapper.unmount();
	});

	it('resolves the server\'s relative media paths against the signed-in server, not the receiver origin', async () => {
		players.length = 0;
		const { authStore } = await import('@/stores/authStore');
		authStore.serverUrl.value = 'https://192-0-2-10.example.invalid:7626';
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;

		// The media server sends file paths relative to itself (TvShowsController.Watch).
		const item = { id: '1', title: 'One', duration: 100, file: '/library/one/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: { type: 'tv', id: '1', playlist: [item], initialItem: item },
			global: { plugins: [router()] },
		});
		await flushPromises();

		expect(players[0]!.setup).toHaveBeenCalledWith(expect.objectContaining({
			baseUrl: 'https://192-0-2-10.example.invalid:7626',
			baseImageUrl: 'https://image.tmdb.org/t/p/original',
		}));
		// The player attaches the bearer token only to these origins; without it the server answers 401.
		const options = players[0]!.setup.mock.calls[0]![0] as { auth?: { mediaOrigins?: () => unknown } };
		expect(options.auth?.mediaOrigins?.()).toBe('https://192-0-2-10.example.invalid:7626');

		authStore.serverUrl.value = null;
		wrapper.unmount();
	});

	it('starts with the subtitle and audio the phone showed, as the player\'s stored pick', async () => {
		players.length = 0;
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;

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
			global: { plugins: [router()] },
		});
		await flushPromises();

		const options = players[0]!.setup.mock.calls[0]![0] as { storage?: { get: (key: string) => unknown } };
		expect(JSON.parse(String(options.storage?.get('nmplayer-language-subtitle'))))
			.toEqual({ language: 'eng', type: 'full', format: 'ass', explicit: true });
		expect(options.storage?.get('nmplayer-language-audio')).toBe('eng');

		wrapper.unmount();
	});

	it('adds newly encoded episodes after the playing item without reloading it', async () => {
		players.length = 0;
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const episode = (id: string) => ({ id, title: id, file: `https://example.invalid/${id}.m3u8` });
		const [e1, e1a, e2, e3, e4, e5, e6] = ['e1', 'e1a', 'e2', 'e3', 'e4', 'e5', 'e6'].map(episode);
		const wrapper = mount(VideoPlayer, {
			props: { type: 'tv', id: 'placeholder-show', playlist: [e1, e2, e4], initialItem: e2 },
			global: { plugins: [router()] },
		});
		await flushPromises();
		const player = players[0]!;
		const onQueue = player.once.mock.calls.find(([event]) => event === 'queue')?.[1] as (() => void);
		onQueue();

		await wrapper.setProps({ playlist: [e1, e1a, e2, e3, e4, e5, e6] });

		const replacements = player.queue.mock.calls.filter(args => args.length > 0);
		expect(replacements).toEqual([[[e1, e2, e3, e4, e5, e6]]]);
		expect(player.seekToIndex.mock.calls).toEqual([[1]]);
		expect(player.dispose).not.toHaveBeenCalled();
		expect(player.setup).toHaveBeenCalledTimes(1);
		await wrapper.setProps({ playlist: [e1, e1a, e2, e3, e4, e5, e6] });
		expect(player.queue.mock.calls.filter(args => args.length > 0)).toHaveLength(1);
		wrapper.unmount();
	});

	it('registers the subtitle overlay and the libass renderer before setup, served from the receiver origin', async () => {
		players.length = 0;
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const item = { id: '1', title: 'One', file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: { type: 'movie', id: '1', playlist: [item], initialItem: item },
			global: { plugins: [router()] },
		});
		await flushPromises();

		const player = players[0]!;
		const added = player.addPlugin.mock.calls as unknown as Array<[unknown, { workerUrl?: string; fallbackFont?: string }?]>;
		expect(added.map(([plugin]) => plugin)).toEqual([SubtitleOverlayPlugin, OctopusPlugin]);
		const options = added[1]![1]!;
		expect(options.workerUrl).toBe('/js/octopus/nomercy-libass-worker.js');
		expect(options.fallbackFont).toBe('/js/octopus/default.ttf');
		expect(options.workerUrl).not.toContain('http');
		// The video player's own dist ships the retired 4.1.0 worker; only the copied 0.2.x files may load.
		for (const value of Object.values(options).filter(entry => typeof entry === 'string')) {
			expect(value).not.toContain('subtitles-octopus-worker');
			expect(value).not.toContain('nomercy-video-player');
		}
		const lastAdd = Math.max(...player.addPlugin.mock.invocationCallOrder);
		expect(lastAdd).toBeLessThan(player.setup.mock.invocationCallOrder[0]!);

		wrapper.unmount();
	});

	it('passes the bearer token through auth', async () => {
		players.length = 0;
		const { authStore } = await import('@/stores/authStore');
		authStore.accessToken.value = 'placeholder-token';
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const item = { id: '1', title: 'One', file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: { type: 'movie', id: '1', playlist: [item], initialItem: item },
			global: { plugins: [router()] },
		});
		await flushPromises();

		const options = players[0]!.setup.mock.calls[0]![0] as { auth?: { bearerToken?: () => string }; accessToken?: unknown };
		expect(options.accessToken).toBeUndefined();
		expect(options.auth?.bearerToken?.()).toBe('placeholder-token');

		authStore.accessToken.value = null;
		wrapper.unmount();
	});

	it('resumes at resumeAt once duration reports a value', async () => {
		players.length = 0;
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const item = { id: '1', title: 'One', file: 'https://example.invalid/one.m3u8' };
		const wrapper = mount(VideoPlayer, {
			props: { type: 'movie', id: '1', playlist: [item], initialItem: item, resumeAt: 42 },
			global: { plugins: [router()] },
		});
		await flushPromises();

		const player = players[0]!;
		player.fire('ready');
		expect(player.time.mock.calls.filter(call => call.length > 0)).toEqual([]);
		player.setDuration(120);
		player.fire('time');
		const seeks = player.time.mock.calls.filter(call => call.length > 0);
		expect(seeks).toEqual([[42]]);

		wrapper.unmount();
	});
});
