import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, LifecycleRegistry } from '@nomercy-entertainment/nomercy-player-core';
import { TvUiPlugin } from './index';
import type { TvUiOptions } from './index';

vi.mock('@/lib/http/client', () => ({
	apiFetch: vi.fn<(options: { path: string; method: string }) => Promise<unknown>>(),
	HttpError: class HttpError extends Error {
		constructor(message: string, public readonly status: number, public readonly body: string) {
			super(message);
		}
	},
}));

const { apiFetch } = await import('@/lib/http/client');

interface Item {
	id: number;
	title: string;
	image?: string;
	video_id?: string;
	video_type?: string;
	tmdb_id?: number;
	skip_segments?: Array<{
		type: string;
		credits_start: number;
		content_end: number;
	}>;
	season?: number;
	episode?: number;
}

interface Level { index: number; label: string }

class FakePlayer extends EventEmitter<Record<string, unknown>> {
	levels: Level[] = [];
	container = document.createElement('div');
	options = {};
	state = 'paused';
	now = 0;
	length = 100;
	bufferedTo = 0;
	items: Item[] = [{
		id: 1,
		title: 'One',
		image: '/one.jpg',
		video_id: 'f1',
		video_type: 'tv',
		tmdb_id: 7,
	}, { id: 2, title: 'Two' }];

	calls: string[] = [];
	seeks: number[] = [];
	added: Array<{
		url: string;
		language: string;
		label?: string;
	}> = [];

	playState = (): string => this.state;
	time = (value?: number): number => {
		if (value !== undefined) {
			this.seeks.push(value);
			this.now = value;
		}

		return this.now;
	};

	duration = (): number => this.length;
	buffered = (): number => this.bufferedTo;
	queue = (): Item[] => this.items;
	item = (): Item => this.items[0]!;
	index = (): number => 0;
	chapters = (): never[] => [];
	play = vi.fn<() => Promise<void>>(async () => {
		this.calls.push('play');
		this.state = 'playing';
	});

	pause = vi.fn<() => Promise<void>>(async () => {
		this.calls.push('pause');
		this.state = 'paused';
	});

	restart = vi.fn<() => void>();
	next = vi.fn<() => void>();
	addSubtitleTrack = (track: {
		url: string;
		language: string;
		label?: string;
	}) => {
		this.added.push(track);

		return track;
	};

	subtitles = (): never[] => [];
	audioTracks = (): never[] => [];
	qualityLevels = (): Level[] => this.levels;
	subtitle = (): null => null;
	audioTrack = (): null => null;
	quality = (): string => 'auto';
	subtitleStyle = vi.fn<(patch?: Record<string, string>) => Record<string, never>>(() => ({}));
	volume = (): number => 30;
	volumeState = (): string => 'unmuted';
	toggleMute = vi.fn<() => void>();
}

// A plugin's window key listener outlives its test unless its lifecycle is disposed.
const registries: LifecycleRegistry[] = [];

function setup(options: TvUiOptions = { skipPreScreen: true }) {
	const player = new FakePlayer();

	document.body.append(player.container);
	const plugin = new TvUiPlugin();
	const lifecycle = new LifecycleRegistry();

	registries.push(lifecycle);
	plugin.initialize(player as never, options, lifecycle);
	plugin.use();

	return {
		player,
		plugin,
		root: player.container.querySelector<HTMLElement>('.tvui-root')!,
	} as const satisfies {
		player: FakePlayer;
		plugin: TvUiPlugin;
		root: HTMLElement;
	};
}

function press(key: string): void {
	window.dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

const pill = (root: HTMLElement): HTMLElement | null => root.querySelector('[data-skip-prompt]');

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	registries.splice(0).forEach((registry) => registry.dispose());
	vi.useRealTimers();
	document.body.replaceChildren();
	vi.mocked(apiFetch).mockReset();
});

describe('chapter skip and next-episode prompts (TVOverlayPlugin.ts:88-91, :156-219)', () => {
	it('shows a skip pill for chapter-skip-available, a click seeks to the chapter end and clears it', () => {
		const { player, root } = setup();

		player.emit('chapter-skip-available', {
			type: 'intro',
			startTime: 5,
			endTime: 40,
		});

		expect(pill(root)?.textContent).toBe('Skip intro');
		pill(root)!.click();
		expect(player.seeks).toEqual([40]);
		expect(pill(root)).toBeNull();
	});

	it('chapter-skip-clear removes the pill', () => {
		const { player, root } = setup();

		player.emit('chapter-skip-available', { type: 'credits', endTime: 90 });
		expect(pill(root)?.textContent).toBe('Skip credits');
		player.emit('chapter-skip-clear');
		expect(pill(root)).toBeNull();
	});

	it('offers the next episode inside the credits and advances once at the content end', () => {
		const { player, root } = setup();

		player.items[0]!.skip_segments = [{
			type: 'credits',
			credits_start: 80,
			content_end: 95,
		}];

		player.now = 85;
		player.emit('time', { time: 85 });
		expect(pill(root)?.textContent).toBe('Next episode');
		player.now = 96;
		player.emit('time', { time: 96 });
		player.emit('time', { time: 97 });
		expect(player.next).toHaveBeenCalledTimes(1);
	});

	it('hides the pill while the settings panel is open (SkipOverlay unmounts)', () => {
		const { player, root } = setup();

		player.emit('pause');
		player.emit('chapter-skip-available', { type: 'intro', endTime: 40 });
		root.querySelector<HTMLElement>('.tvui-top-bar button')!.click();
		expect(root.querySelector('.tvui-settings')).not.toBeNull();
		expect(pill(root)).toBeNull();
	});
});

describe('first-frame overlays and messages (TvUiPlugin.kt:624-666)', () => {
	it('shows the item backdrop and the loading overlay until a frame plays', () => {
		const { player, root } = setup();

		player.length = 0;
		player.emit('item', { item: player.items[0], index: 0 });
		expect(root.querySelector('.tvui-backdrop')).not.toBeNull();
		expect(root.querySelector('.tvui-loading')).not.toBeNull();
		player.length = 100;
		player.now = 5;
		player.state = 'playing';
		player.emit('time', { time: 5 });
		expect(root.querySelector('.tvui-backdrop')).toBeNull();
		expect(root.querySelector('.tvui-loading')).toBeNull();
	});

	it('shows the player message at the top center and removes it', () => {
		const { player, root } = setup();

		player.emit('display-message', { text: 'Subtitles off' });
		expect(root.querySelector('.tvui-center-message')?.textContent).toBe('Subtitles off');
		player.emit('remove-message');
		expect(root.querySelector('.tvui-center-message')).toBeNull();
	});
});

describe('engine accessors', () => {
	it('enter with hidden controls pauses a playing engine through playState()', () => {
		const { player } = setup();

		player.now = 5;
		player.emit('time', { time: 5 });
		player.state = 'playing';
		press('Enter');
		expect(player.pause).toHaveBeenCalledTimes(1);
	});

	it('the volume indicator reads volume() and volumeState()', () => {
		const { root } = setup();

		press('AudioVolumeUp');
		vi.advanceTimersByTime(60);
		expect(root.querySelector('.tvui-volume')?.textContent).toContain('30%');
	});

	it('writes the subtitle style with the engine field names', () => {
		const { player, root } = setup();

		player.emit('pause');
		root.querySelector<HTMLElement>('.tvui-top-bar button')!.click();
		const rows = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('.tvui-sidebar-rows .tvui-row'));

		rows().find((row) => row.textContent?.startsWith('Subtitle style'))!.click();
		vi.advanceTimersByTime(400);
		rows().find((row) => row.textContent?.startsWith('Edge'))!.click();
		vi.advanceTimersByTime(400);
		rows().find((row) => row.textContent?.includes('Drop shadow'))!.click();
		expect(player.subtitleStyle).toHaveBeenCalledWith({ edgeStyle: 'dropShadow' });
	});
});

describe('scrub strip (TVSeekContainer.kt:61-173)', () => {
	it('shows the highlighted frame time in the bottom bar while scrubbing', () => {
		const { player, root } = setup();

		player.emit('pause');
		press('ArrowRight');
		press('ArrowRight');
		expect(root.querySelector('.tvui-seek-strip')).not.toBeNull();
		expect(root.querySelector('.tvui-bottom-bar .tvui-time')?.textContent).toBe('00:10');
	});

	it('draws the buffered bar from buffered() over duration()', () => {
		const { player, root } = setup();

		player.bufferedTo = 40;
		player.emit('pause');
		player.emit('time', { time: 0 });
		expect(root.querySelector<HTMLElement>('.tvui-chapter')?.style.getPropertyValue('--buffered')).toBe('40%');
	});
});

describe('subtitle search dialog (SubtitleSearchDialog.kt:60-300)', () => {
	const found = { data: [{
		id: 'a',
		download_url: 'https://example.test/s.srt',
		language: 'nl',
		language_name: 'Dutch',
		release_name: 'Rel',
		downloads: 12,
		format: 'srt',
		hearing_impaired: false,
	}] };

	async function openSearch(): Promise<{ player: FakePlayer; root: HTMLElement }> {
		const { player, root } = setup({ skipPreScreen: false });
		const buttons = Array.from(root.querySelectorAll<HTMLElement>('.tvui-pre-buttons button'));

		buttons.find((button) => button.textContent?.includes('Audio'))!.click();
		Array.from(root.querySelectorAll<HTMLElement>('.tvui-row')).find((row) => row.textContent?.includes('Search subtitles online'))!.click();
		await vi.advanceTimersByTimeAsync(0);

		return { player, root };
	}

	it('searches the playing item, lists the candidates and downloads the picked one', async () => {
		vi.mocked(apiFetch).mockResolvedValueOnce(found).mockResolvedValueOnce({ data: {
			file: '/s/nl.srt',
			kind: 'subtitles',
			label: 'Dutch',
			language: 'nl',
		} });

		const { player, root } = await openSearch();

		expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toMatchObject({ method: 'GET', path: expect.stringContaining('/api/v1/subtitles/search?type=tv&id=7&videoFileId=f1') });
		const row = root.querySelector<HTMLElement>('.tvui-result')!;

		expect(row.textContent).toContain('Dutch');
		row.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(vi.mocked(apiFetch).mock.calls[1]?.[0]).toMatchObject({ method: 'POST', path: '/api/v1/subtitles/download' });
		expect(player.added).toHaveLength(1);
		expect(player.added[0]).toMatchObject({ language: 'nl', label: 'Dutch' });
		expect(player.added[0]?.url.endsWith('/s/nl.srt')).toBe(true);
		expect(root.textContent).toContain('Subtitle added');
	});

	it('says so when the provider is rate limited and BACK closes the dialog', async () => {
		const { HttpError } = await import('@/lib/http/client');

		vi.mocked(apiFetch).mockRejectedValueOnce(new HttpError('x', 429, ''));
		const { root } = await openSearch();

		expect(root.textContent).toContain('rate-limited');
		press('Escape');
		expect(root.querySelector('.tvui-search')).toBeNull();
	});
});

describe('subtitle search statuses (SubtitleSearchDialog.kt:133-208)', () => {
	const candidate = {
		id: 'a',
		download_url: 'https://example.test/s.srt',
		language: 'nl',
		language_name: 'Dutch',
		release_name: 'Rel',
		downloads: 12,
		rating: 8.25,
		format: 'srt',
		hearing_impaired: true,
	};

	async function openSearchWith(search: () => Promise<unknown>): Promise<HTMLElement> {
		vi.mocked(apiFetch).mockImplementationOnce(search as never);
		const { root } = setup({ skipPreScreen: false });

		Array.from(root.querySelectorAll<HTMLElement>('.tvui-pre-buttons button'))
			.find((button) => button.textContent?.includes('Audio'))!
			.click();

		Array.from(root.querySelectorAll<HTMLElement>('.tvui-row'))
			.find((row) => row.textContent?.includes('Search subtitles online'))!
			.click();

		await vi.advanceTimersByTimeAsync(0);

		return root;
	}

	it('k18a a result row shows the language, release, downloads, rating and hearing impaired', async () => {
		const root = await openSearchWith(async () => ({ data: [candidate] }));
		const text = root.querySelector('.tvui-result')?.textContent;

		expect(text).toContain('Dutch');
		expect(text).toContain('Rel');
		expect(text).toContain('12 downloads');
		expect(text).toContain('Rating 8.3');
		expect(text).toContain('Hearing impaired');
	});

	it('k18b while the search runs only the loading line shows, with a spinner', async () => {
		const root = await openSearchWith(() => new Promise(() => undefined));

		expect(root.querySelector('.tvui-search')?.textContent).toContain('Searching for subtitles');
		expect(root.querySelector('.tvui-search .tvui-spinner')).not.toBeNull();
		expect(root.querySelector('.tvui-result')).toBeNull();
	});

	it('k18c an empty search says so with no spinner and no icon', async () => {
		const root = await openSearchWith(async () => ({ data: [] }));

		expect(root.querySelector('.tvui-search')?.textContent).toContain('No subtitles found');
		expect(root.querySelector('.tvui-search .tvui-spinner')).toBeNull();
		expect(root.querySelector('.tvui-search [data-icon]')).toBeNull();
	});

	it('k18d a failed search shows the error line with the alert icon', async () => {
		const root = await openSearchWith(async () => Promise.reject(new Error('down')));

		expect(root.querySelector('.tvui-search')?.textContent).toContain('Couldn\'t search');
		expect(root.querySelector('.tvui-search [data-icon="alertTriangle"]')).not.toBeNull();
	});

	it('k18e a download in flight replaces the list with its status line', async () => {
		const root = await openSearchWith(async () => ({ data: [candidate] }));

		vi.mocked(apiFetch).mockImplementationOnce(() => new Promise(() => undefined));
		root.querySelector<HTMLElement>('.tvui-result')!.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(root.querySelector('.tvui-search')?.textContent).toContain('Downloading subtitle');
		expect(root.querySelector('.tvui-result')).toBeNull();
	});

	it('k18f a finished download replaces the list with the success line and a check', async () => {
		const root = await openSearchWith(async () => ({ data: [candidate] }));

		vi.mocked(apiFetch).mockResolvedValueOnce({ data: {
			file: '/s/nl.srt',
			kind: 'subtitles',
			label: 'Dutch',
			language: 'nl',
		} });

		root.querySelector<HTMLElement>('.tvui-result')!.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(root.querySelector('.tvui-search')?.textContent).toContain('Subtitle added');
		expect(root.querySelector('.tvui-search [data-icon="check"]')).not.toBeNull();
		expect(root.querySelector('.tvui-result')).toBeNull();
	});

	it('k18g a failed download replaces the list with the error line', async () => {
		const root = await openSearchWith(async () => ({ data: [candidate] }));

		vi.mocked(apiFetch).mockRejectedValueOnce(new Error('down'));
		root.querySelector<HTMLElement>('.tvui-result')!.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(root.querySelector('.tvui-search')?.textContent).toContain('Couldn\'t download');
		expect(root.querySelector('.tvui-result')).toBeNull();
	});

	it('k18h the dialog has no close button, BACK is the only exit', async () => {
		const root = await openSearchWith(async () => ({ data: [candidate] }));

		expect(root.querySelector('.tvui-search .tvui-icon-button')).toBeNull();
	});
});

describe('quality choice (PlayerSettingsScreen.kt mainRows, LanguageDialog.kt:83)', () => {
	const only = [{ index: 0, label: '1080p' }];
	const two = [...only, { index: 1, label: '720p' }];

	function openSettings(levels: Level[]): HTMLElement {
		const { player, root } = setup();

		player.levels = levels;
		player.emit('pause');
		root.querySelector<HTMLElement>('.tvui-top-bar button')!.click();

		return root;
	}

	function qualityRow(root: HTMLElement): HTMLElement {
		return Array.from(root.querySelectorAll<HTMLElement>('.tvui-sidebar-rows .tvui-row'))
			.find((row) => row.textContent?.startsWith('Quality'))!;
	}

	function columnTitles(levels: Level[]): string[] {
		const { player, root } = setup({ skipPreScreen: false });

		player.levels = levels;

		Array.from(root.querySelectorAll<HTMLElement>('.tvui-pre-buttons button'))
			.find((button) => button.textContent?.includes('Audio'))!
			.click();

		return Array.from(root.querySelectorAll('.tvui-column-title')).map((title) => title.textContent ?? '');
	}

	it('p03a one real level leaves the settings quality row disabled', () => {
		expect(qualityRow(openSettings(only)).hasAttribute('aria-disabled')).toBe(true);
	});

	it('p03b two real levels enable the settings quality row', () => {
		expect(qualityRow(openSettings(two)).hasAttribute('aria-disabled')).toBe(false);
	});

	it('d13a one real level hides the quality column of the language dialog', () => {
		expect(columnTitles(only)).not.toContain('Quality');
	});

	it('d13b two real levels show the quality column of the language dialog', () => {
		expect(columnTitles(two)).toContain('Quality');
	});
});

describe('focus watchdog (TvUiPlugin.kt:424-485)', () => {
	it('claims focus back for the open dialog when it left the player', () => {
		const { root } = setup({ skipPreScreen: false });

		(document.activeElement as HTMLElement | null)?.blur();
		expect(root.contains(document.activeElement)).toBe(false);
		vi.advanceTimersByTime(600);
		expect(root.contains(document.activeElement)).toBe(true);
	});
});

// PlayerSettingsScreen.kt:661-703: the style rows show translated edge and color names.
describe('subtitle style pane values', () => {
	it('shows the edge and color as translated names, not tokens', () => {
		const { player, root } = setup();

		player.emit('pause');
		root.querySelector<HTMLElement>('.tvui-top-bar button')!.click();

		Array.from(root.querySelectorAll<HTMLElement>('.tvui-sidebar-rows .tvui-row'))
			.find((row) => row.textContent?.startsWith('Subtitle style'))!
			.click();

		vi.advanceTimersByTime(400);

		const values = Array.from(root.querySelectorAll<HTMLElement>('.tvui-sidebar-rows .tvui-row-value')).map((node) => node.textContent);

		expect(values).toContain('White');
		expect(values).toContain('None');
	});
});

describe('settings sidebar shrink and title (WatchScreen.kt:508-560, :626-660)', () => {
	function openSettings() {
		const ctx = setup();
		const video = document.createElement('video');
		const safezone = document.createElement('div');
		const overlay = document.createElement('div');

		const canvas = document.createElement('div');
		const plain = document.createElement('div');

		safezone.className = 'subtitle-safezone';
		// The mount nomercy-video-player's octopus plugin creates (plugins/octopus ensureFrame).
		canvas.className = 'nomercy-libass-box';
		plain.className = 'ass-plain-text';
		overlay.append(safezone);
		ctx.player.container.append(video, overlay, canvas, plain);
		ctx.player.length = 0;
		ctx.player.emit('item', { item: ctx.player.items[0], index: 0 });
		ctx.player.emit('pause');
		ctx.root.querySelector<HTMLElement>('.tvui-top-bar button')!.click();

		return {
			...ctx,
			video,
			safezone,
			canvas,
			plain,
		};
	}

	it('x17 the libass canvas and the plain-text fallback shrink inside the frame', () => {
		const { canvas, plain } = openSettings();

		expect([canvas, plain].map((layer) => layer.style.transform.includes('scale('))).toEqual([true, true]);
	});

	it('shrinks the video, the subtitle layer, the backdrop and the loading layer together', () => {
		const { root, video, safezone } = openSettings();
		const layers = [video, safezone, root.querySelector<HTMLElement>('.tvui-backdrop')!, root.querySelector<HTMLElement>('.tvui-loading')!];

		expect(layers.map((layer) => layer.style.transform.includes('scale('))).toEqual([true, true, true, true]);
	});

	it('puts every layer back when the sidebar closes', () => {
		const { root, video, safezone } = openSettings();

		root.querySelector<HTMLElement>('.tvui-sidebar-header button')!.click();
		expect([video.style.transform, safezone.style.transform]).toEqual(['', '']);
	});

	// WatchScreen.kt:587: the shrunk picture keeps its black; around it shows the app background (slate_12).
	it('x25 the app background shows around the shrunk picture, the picture stays black', () => {
		const { root, video, player } = openSettings();

		expect([player.container.style.background, video.style.background]).toEqual(['var(--cast-bg-base)', 'black']);

		root.querySelector<HTMLElement>('.tvui-sidebar-header button')!.click();
		expect([player.container.style.background, video.style.background]).toEqual(['', '']);
	});

	it('keeps the title at the top while the sidebar is open', () => {
		const { root } = openSettings();

		expect(root.querySelector('.tvui-sticky-title .tvui-title')?.textContent).toBe('One');
	});
});
