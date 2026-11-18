import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The first Intl.DisplayNames took 12.4 s on the CI runner (28 ms locally), so
// it is built here with its own limit instead of inside the 5 s test.
let TrailerOverlay: typeof import('./TrailerOverlay.vue').default;

beforeAll(async () => {
	new Intl.DisplayNames(['en'], { type: 'language', fallback: 'code' }).of('en');
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
	time: vi.fn((_seconds?: number) => 0),
	duration: vi.fn(() => 0),
	subtitles: vi.fn((): Array<{ label: string }> => []),
	subtitle: vi.fn((_index?: number | null): { index: number } | null => null),
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
		const wrapper = mount(TrailerOverlay, {
			props: {
				trailer: {
					videoId: 'placeholder-video',
					title: 'Trailer',
					url: 'https://example.invalid/trailer.mp4',
					subtitles: [{
						file: 'trailer.en.vtt',
						language: 'en',
						url: 'https://example.invalid/trailer.en.vtt',
					}],
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
		const wrapper = mount(TrailerOverlay, {
			props: {
				trailer: {
					videoId: 'placeholder-video',
					title: 'Trailer',
					url: 'https://example.invalid/trailer.mp4',
					subtitles: [],
				},
				fallbackTitle: 'Fallback',
			},
			global: { stubs: { Teleport: true } },
		});

		await flushPromises();

		expect(container.querySelector('.tv-overlay-host')).not.toBeNull();

		wrapper.unmount();
	});
});

describe('the trailer controls are the tv-ui panels', () => {
	const trailer = {
		videoId: 'placeholder-video',
		title: 'Trailer',
		url: 'https://example.invalid/trailer.mp4',
		subtitles: [],
	};

	async function mountTrailer() {
		const wrapper = mount(TrailerOverlay, {
			props: { trailer, fallbackTitle: 'Fallback' },
			global: { stubs: { Teleport: true } },
		});

		await flushPromises();

		return wrapper;
	}

	function press(key: string): void {
		window.dispatchEvent(new KeyboardEvent('keydown', {
			key,
			bubbles: true,
			cancelable: true,
		}));
	}

	it('draws the title in the tv-ui top bar and the progress in the tv-ui bottom bar', async () => {
		const wrapper = await mountTrailer();

		expect(container.querySelector('.tvui-top-bar .tvui-title')?.textContent).toBe('Trailer');
		expect(container.querySelector('.tvui-bottom-bar .tvui-chapter-bar')).not.toBeNull();
		expect(container.querySelector('.playback-osd')).toBeNull();

		wrapper.unmount();
	});

	it('left pauses and opens the tv-ui scrub strip, Enter seeks to the tile and plays', async () => {
		player.duration.mockReturnValue(100);
		player.time.mockReturnValue(25);
		player.pause.mockClear();
		player.play.mockClear();
		const wrapper = await mountTrailer();

		press('ArrowLeft');
		expect(player.pause).toHaveBeenCalledTimes(1);
		expect(container.querySelector('.tvui-seek-strip')).not.toBeNull();
		expect(container.querySelector('.seek-container')).toBeNull();

		press('ArrowRight');
		press('Enter');
		expect(player.time).toHaveBeenLastCalledWith(30);
		expect(player.play).toHaveBeenCalledTimes(1);
		expect(container.querySelector('.tvui-seek-strip')).toBeNull();

		player.duration.mockReturnValue(0);
		player.time.mockReturnValue(0);
		wrapper.unmount();
	});

	it('the language key opens the subtitle picker and a pick selects that track', async () => {
		player.subtitles.mockReturnValue([{ label: 'English' }, { label: 'Dutch' }]);
		player.subtitle.mockClear();
		const wrapper = await mountTrailer();

		press('l');
		const rows = Array.from(container.querySelectorAll<HTMLElement>('.tvui-languages .tvui-row'));

		expect(rows.map((row) => row.textContent)).toEqual(['Off', 'English', 'Dutch']);
		rows[2]!.click();
		expect(player.subtitle).toHaveBeenCalledWith(1);
		expect(container.querySelector('.tvui-languages')).toBeNull();

		player.subtitles.mockReturnValue([]);
		wrapper.unmount();
	});

	// TrailerOverlayPlayer.kt:173-180: the UI plugin consumes Back first, else the trailer dismisses.
	it('back closes the trailer and consumes the key, so the receiver app stays open', async () => {
		const wrapper = await mountTrailer();
		const event = new KeyboardEvent('keydown', {
			key: 'Escape',
			bubbles: true,
			cancelable: true,
		});

		window.dispatchEvent(event);

		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(event.defaultPrevented).toBe(true);

		wrapper.unmount();
	});

	it('back closes an open panel first and the trailer only on the next press', async () => {
		player.subtitles.mockReturnValue([{ label: 'English' }]);
		const wrapper = await mountTrailer();

		press('l');
		press('GoBack');
		expect(container.querySelector('.tvui-languages')).toBeNull();
		expect(wrapper.emitted('close')).toBeUndefined();

		press('GoBack');
		expect(wrapper.emitted('close')).toHaveLength(1);

		player.subtitles.mockReturnValue([]);
		wrapper.unmount();
	});
});

// TrailerTvUiPlugin.kt:270-272 puts focus on play/pause when the bars appear, :170-178 lets Up and Down
// move focus once they show, :181 leaves Left and Right to the top bar while it holds focus.
describe('the trailer controls take D-pad focus', () => {
	const trailer = {
		videoId: 'placeholder-video',
		title: 'Trailer',
		url: 'https://example.invalid/trailer.mp4',
		subtitles: [{
			language: 'en',
			file: 'trailer.sdh.srt',
			url: 'https://example.invalid/trailer.en.vtt',
		}],
	};

	beforeAll(() => {
		document.body.append(container);
		HTMLElement.prototype.scrollIntoView = vi.fn();

		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
			const top = this.closest('.tvui-top-bar')
				? 0
				: 500;

			return {
				top,
				bottom: top + 40,
				left: 0,
				right: 40,
				width: 40,
				height: 40,
				x: 0,
				y: top,
				toJSON: () => ({}),
			};
		});
	});

	afterAll(() => {
		container.remove();
		vi.restoreAllMocks();
	});

	async function mountTrailer() {
		player.subtitles.mockReturnValue([{ label: 'English SDH (Hearing Impaired)' }]);
		const wrapper = mount(TrailerOverlay, {
			props: { trailer, fallbackTitle: 'Fallback' },
			global: { stubs: { Teleport: true } },
			attachTo: document.body,
		});

		await flushPromises();

		return wrapper;
	}

	function press(key: string): void {
		window.dispatchEvent(new KeyboardEvent('keydown', {
			key,
			bubbles: true,
			cancelable: true,
		}));
	}

	const playButton = () => container.querySelector<HTMLElement>('.tvui-bottom-bar .tvui-icon-button');
	const settingsButton = () => container.querySelector<HTMLElement>('.tvui-top-bar .tvui-icon-button');

	it('puts focus on play/pause when the controls appear', async () => {
		const wrapper = await mountTrailer();

		expect(document.activeElement).toBe(playButton());

		wrapper.unmount();
	});

	it('up moves focus from play/pause to the top bar settings button, which shows the ring target', async () => {
		const wrapper = await mountTrailer();

		press('ArrowUp');

		expect(document.activeElement).toBe(settingsButton());

		wrapper.unmount();
	});

	it('left on the top bar moves focus instead of opening the seek strip', async () => {
		player.duration.mockReturnValue(100);
		const wrapper = await mountTrailer();

		press('ArrowUp');
		press('ArrowLeft');

		expect(container.querySelector('.tvui-seek-strip')).toBeNull();

		player.duration.mockReturnValue(0);
		wrapper.unmount();
	});

	it('enter on the focused settings button opens the subtitle picker, Off first', async () => {
		const wrapper = await mountTrailer();

		press('ArrowUp');
		settingsButton()!.click();

		const rows = Array.from(container.querySelectorAll<HTMLElement>('.tvui-languages .tvui-row'));

		expect(rows.map((row) => row.textContent)).toEqual(['Off', 'English SDH (Hearing Impaired)']);

		player.subtitles.mockReturnValue([]);
		wrapper.unmount();
	});

	it('gives focus back to the sink when the controls hide, so Enter still plays and pauses', async () => {
		const wrapper = await mountTrailer();

		Object.defineProperty(player.videoElement, 'paused', { value: false, configurable: true });
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		press('ArrowUp');
		press('ArrowDown');
		expect(document.activeElement).toBe(playButton());
		vi.advanceTimersByTime(4000);
		vi.useRealTimers();

		expect(container.querySelector('.tvui-bottom-bar')).toBeNull();
		expect(document.activeElement).not.toBe(settingsButton());
		expect(document.activeElement?.classList.contains('trailer-focus')).toBe(true);

		Object.defineProperty(player.videoElement, 'paused', { value: true, configurable: true });
		wrapper.unmount();
	});

	it('labels each trailer track with the KMP formatter and keeps Off first', async () => {
		const wrapper = await mountTrailer();
		const config = setup.mock.calls.at(-1)![0] as {
			playlist: Array<{ subtitles: Array<{ label: string }> }>;
		};

		expect(config.playlist[0]!.subtitles[0]!.label).toBe('English SDH (Hearing Impaired)');

		wrapper.unmount();
	});
});

// The player appends a bare <video>. Without a rule it keeps its own pixel size at the top left
// (the TV showed a 640x352 box), where the native PlayerSurface is fillMaxSize
// (TrailerOverlayPlayer.kt:200-203).
describe('the trailer video fills the screen like the native PlayerSurface', () => {
	const file = resolve(process.cwd(), 'src/players/video/TrailerOverlay.vue');
	const source = readFileSync(file, 'utf8');
	const rule = source.match(/\.trailer-surface\s+:deep\(video\)\s*\{([^}]*)\}/)?.[1] ?? '';

	it('has a rule for the player video element', () => {
		expect(rule).not.toBe('');
	});

	it('pins the video to the surface at full size and keeps the picture whole', () => {
		expect(rule).toMatch(/position:\s*absolute/);
		expect(rule).toMatch(/width:\s*100%/);
		expect(rule).toMatch(/height:\s*100%/);
		expect(rule).toMatch(/object-fit:\s*contain/);
	});

	it('insets the player 32 px like the native black box (TrailerOverlayPlayer.kt:190-194)', () => {
		expect(source).toMatch(/\.trailer-overlay\s*\{[^}]*padding:\s*32px/);
	});
});
