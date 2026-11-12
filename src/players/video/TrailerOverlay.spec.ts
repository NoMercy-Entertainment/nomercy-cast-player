import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

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
		const TrailerOverlay = (await import('./TrailerOverlay.vue')).default;
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
		await flushPromises();

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
		const TrailerOverlay = (await import('./TrailerOverlay.vue')).default;
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
