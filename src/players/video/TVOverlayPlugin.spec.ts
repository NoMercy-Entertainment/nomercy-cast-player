import { afterEach, describe, expect, it, vi } from 'vitest';

import { TVOverlayPlugin } from './TVOverlayPlugin';

// The 2.x player has no overlay element, only the container it mounts into.
function fakePlayer() {
	const handlers = new Map<string, Array<(data?: unknown) => void>>();
	const container = document.createElement('div');
	document.body.append(container);

	return {
		container,
		on(event: string, handler: (data?: unknown) => void) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		off(event: string, handler?: (data?: unknown) => void) {
			handlers.set(event, (handlers.get(event) ?? []).filter(entry => handler && entry !== handler));
		},
		// Synchronous dispatch, same as the real player's CustomEvent-backed emit.
		emit: vi.fn((event: string, payload?: unknown) => {
			for (const handler of [...(handlers.get(event) ?? [])])
				handler(payload);
		}),
		play: vi.fn(),
		pause: vi.fn(),
		time: vi.fn(() => 0),
		duration: vi.fn(() => 0),
		subtitles: vi.fn(() => []),
		audioTracks: vi.fn(() => []),
		qualityLevels: vi.fn(() => []),
		subtitle: vi.fn(),
		chapters: vi.fn(() => []),
	};
}

describe('back on the pre-screen exits once, without recursing', () => {
	let plugin: TVOverlayPlugin | null = null;

	afterEach(() => {
		plugin?.detach();
		plugin = null;
		document.body.innerHTML = '';
	});

	it('calls the exit path exactly once and does not overflow the stack', () => {
		const player = fakePlayer();
		const onExit = vi.fn();
		plugin = new TVOverlayPlugin(player as never, { onExit });
		plugin.attach();

		expect(() => player.emit('back')).not.toThrow();
		expect(onExit).toHaveBeenCalledTimes(1);
		expect(player.emit).toHaveBeenCalledTimes(1);
	});
});

describe('the overlay host', () => {
	it('mounts the panels in a host inside the player container and removes it on detach', () => {
		const player = fakePlayer();
		const plugin = new TVOverlayPlugin(player as never, {});
		plugin.attach();

		const host = player.container.querySelector('.tv-overlay-host');
		expect(host).not.toBeNull();
		expect(host!.querySelector('.pre-screen')).not.toBeNull();

		plugin.detach();
		expect(player.container.querySelector('.tv-overlay-host')).toBeNull();
		document.body.innerHTML = '';
	});
});

describe('server credits on the overlay', () => {
	it('offers the next episode before an epilogue and advances at content end', () => {
		const player = fakePlayer();
		const next = vi.fn();
		const item = { id: 'a', title: 'A', skip_segments: [{ type: 'Credits', credits_start: 80, content_end: 110 }] };
		let position = 79;
		const castPlayer = { ...player, next, time: () => position, queue: () => [item, { id: 'b', title: 'B' }], item: () => item, index: () => 0 };
		const plugin = new TVOverlayPlugin(castPlayer as never, { skipPreScreen: true });
		plugin.attach();
		player.emit('time');
		expect(player.container.textContent).not.toContain('Next episode');
		position = 80;
		player.emit('time');
		expect(player.container.textContent).toContain('Next episode');
		position = 100;
		player.emit('time');
		expect(next).not.toHaveBeenCalled();
		position = 110;
		player.emit('time');
		player.emit('time');
		expect(next).toHaveBeenCalledTimes(1);
		plugin.detach();
		player.container.remove();
	});
});

describe('d-pad seek during playback', () => {
	let plugin: TVOverlayPlugin | null = null;

	afterEach(() => {
		plugin?.detach();
		plugin = null;
		document.body.innerHTML = '';
	});

	it.each(['ArrowLeft', 'ArrowRight'])('opens the seek panel on %s', (key) => {
		plugin = new TVOverlayPlugin(fakePlayer() as never, { skipPreScreen: true });
		plugin.attach();

		document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

		expect(document.querySelector('.seek-container')).not.toBeNull();
	});

	it('keeps the pre-screen open when an arrow is pressed', () => {
		plugin = new TVOverlayPlugin(fakePlayer() as never);
		plugin.attach();

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

		expect(document.querySelector('.pre-screen')).not.toBeNull();
		expect(document.querySelector('.seek-container')).toBeNull();
	});
});

describe('picking subtitles in the language panel', () => {
	let plugin: TVOverlayPlugin | null = null;

	afterEach(() => {
		plugin?.detach();
		plugin = null;
		document.body.innerHTML = '';
	});

	it('turns subtitles off with null, which the 2.x player takes instead of -1', () => {
		const player = fakePlayer();
		player.subtitles.mockReturnValue([{ id: 'sub-a', label: 'English' }] as never);
		plugin = new TVOverlayPlugin(player as never, { skipPreScreen: true });
		plugin.attach();

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
		const off = [...document.querySelectorAll<HTMLElement>('.language-screen button')].find(button => button.textContent === 'Off');
		expect(off).toBeDefined();
		off!.click();

		expect(player.subtitle).toHaveBeenCalledWith(null);
	});

	it('picks a subtitle by its list position, because 2.x track ids are strings', () => {
		const player = fakePlayer();
		player.subtitles.mockReturnValue([{ id: 'sub-a', label: 'English' }, { id: 'sub-b', label: 'Dutch' }] as never);
		plugin = new TVOverlayPlugin(player as never, { skipPreScreen: true });
		plugin.attach();

		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }));
		const dutch = [...document.querySelectorAll<HTMLElement>('.language-screen button')].find(button => button.textContent === 'Dutch');
		dutch!.click();

		expect(player.subtitle).toHaveBeenCalledWith(1);
	});
});
