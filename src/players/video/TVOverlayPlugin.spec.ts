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
