import { beforeAll, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

// The cold import pulls the whole player tree; on a CI runner that alone can
// pass the 5 s test budget, so it loads once here with its own limit.
let TrailerOverlay: typeof import('./TrailerOverlay.vue').default;
beforeAll(async () => {
	TrailerOverlay = (await import('./TrailerOverlay.vue')).default;
}, 30_000);

const setup = vi.fn();
const addPlugin = vi.fn();
const container = document.createElement('div');
const player = {
	container,
	videoElement: document.createElement('video'),
	addPlugin,
	setup,
	on: vi.fn(),
	off: vi.fn(),
	play: vi.fn(),
	pause: vi.fn(),
	time: vi.fn(() => 0),
	duration: vi.fn(() => 0),
	subtitles: vi.fn(() => []),
	subtitle: vi.fn(() => null),
	togglePlayback: vi.fn(),
	dispose: vi.fn(async () => {}),
};
addPlugin.mockReturnValue(player);
setup.mockReturnValue(player);

vi.mock('@nomercy-entertainment/nomercy-video-player', () => ({
	default: () => player,
	OctopusPlugin: class {},
}));
vi.mock('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay', () => ({
	SubtitleOverlayPlugin: class {},
}));

describe('the trailer on the receiver', () => {
	it('hands the 2.x player a url and a poster, with the subtitle urls under subtitles', async () => {
		let t = performance.now();
		const lap = (label: string) => { console.log(`PROBE ${label} ${Math.round(performance.now() - t)}ms`); t = performance.now(); };
		new Intl.DisplayNames(['en', 'en'], { type: 'language', fallback: 'code' }).of('en');
		lap('intl');
		await import('@nomercy-entertainment/nomercy-video-player');
		lap('import player');
		await import('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay');
		lap('import overlay');
		const wrapper = mount(TrailerOverlay, {
			props: {
				trailer: {
					videoId: 'placeholder-video',
					title: 'Trailer',
					url: 'https://example.invalid/trailer.mp4',
					subtitles: [{ language: 'en', url: 'https://example.invalid/trailer.en.vtt' }],
				},
				fallbackTitle: 'Fallback',
			},
			global: { stubs: { Teleport: true } },
		});
		lap('mount');
		await flushPromises();
		lap('flush');

		const config = setup.mock.calls[0]![0] as { playlist: Array<Record<string, unknown>> };
		const item = config.playlist[0]!;
		expect(item.url).toBe('https://example.invalid/trailer.mp4');
		expect(item).toHaveProperty('poster');
		expect(item).not.toHaveProperty('file');
		expect(item).not.toHaveProperty('image');
		expect((item.subtitles as Array<{ url: string }>)[0]!.url).toBe('https://example.invalid/trailer.en.vtt');
		expect(addPlugin).toHaveBeenCalledTimes(2);

		wrapper.unmount();
	});

	it('mounts the controls in a host inside the player container, which has no overlay element in 2.x', async () => {
		const wrapper = mount(TrailerOverlay, {
			props: {
				trailer: { videoId: 'placeholder-video', title: 'Trailer', url: 'https://example.invalid/trailer.mp4', subtitles: [] },
				fallbackTitle: 'Fallback',
			},
			global: { stubs: { Teleport: true } },
		});
		await flushPromises();

		expect(container.querySelector('.tv-overlay-host .playback-osd, .tv-overlay-host')).not.toBeNull();

		wrapper.unmount();
	});
});
