import { afterEach, describe, expect, it, vi } from 'vitest';

import { TVOverlayPlugin } from './TVOverlayPlugin';

function fakePlayer() {
	const handlers = new Map<string, Array<(data?: unknown) => void>>();
	const overlay = document.createElement('div');
	document.body.append(overlay);

	return {
		overlay,
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
		seek: vi.fn(),
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

describe('server credits on the overlay', () => {
	it('offers the next episode before an epilogue and advances at content end', () => {
		const player = fakePlayer();
		const next = vi.fn();
		const item = { id: 'a', title: 'A', skip_segments: [{ type: 'Credits', credits_start: 80, content_end: 110 }] };
		let position = 79;
		const castPlayer = { ...player, next, currentTime: () => position, playlist: () => [item, { id: 'b', title: 'B' }], playlistItem: () => item };
		const plugin = new TVOverlayPlugin(castPlayer as never, { skipPreScreen: true });
		plugin.attach();
		player.emit('time');
		expect(player.overlay.textContent).not.toContain('Next episode');
		position = 80;
		player.emit('time');
		expect(player.overlay.textContent).toContain('Next episode');
		position = 100;
		player.emit('time');
		expect(next).not.toHaveBeenCalled();
		position = 110;
		player.emit('time');
		player.emit('time');
		expect(next).toHaveBeenCalledTimes(1);
		plugin.detach();
		player.overlay.remove();
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
