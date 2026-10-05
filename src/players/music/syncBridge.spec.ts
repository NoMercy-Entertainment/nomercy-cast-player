// The bridge reports the receiver's music engine to the server's MusicHub. Each
// call must name a method the hub has, with the arguments it reads:
// PlaybackCommand(command, data) and CurrentTimeForItemCommand(seconds, itemId).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { socketStore } from '@/stores/socketStore';
import { musicSyncBridge } from './syncBridge';

function fakeEngine() {
	const handlers = new Map<string, Array<(...args: unknown[]) => void>>();

	return {
		on(event: string, handler: (...args: unknown[]) => void) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		off(event: string, handler?: (...args: unknown[]) => void) {
			handlers.set(event, (handlers.get(event) ?? []).filter(entry => handler && entry !== handler));
		},
		emit(event: string, payload?: unknown) {
			for (const handler of [...(handlers.get(event) ?? [])])
				handler(payload);
		},
		play: () => {},
		pause: () => {},
		next: () => {},
		previous: () => {},
		seek: () => {},
		currentTrack: () => ({ id: 4821 }),
	};
}

describe('musicSyncBridge outbound calls', () => {
	const invoke = vi.fn(async () => undefined);
	let engine: ReturnType<typeof fakeEngine>;

	beforeEach(() => {
		invoke.mockClear();
		socketStore.musicHub.value = { invoke, on: () => {}, off: () => {} } as never;
		engine = fakeEngine();
		musicSyncBridge.attach(engine as never);
	});

	afterEach(() => {
		musicSyncBridge.detach();
		socketStore.musicHub.value = null as never;
	});

	it.each(['play', 'pause', 'next', 'previous'])('sends %s as a PlaybackCommand', (command) => {
		engine.emit(command);

		expect(invoke).toHaveBeenCalledExactlyOnceWith('PlaybackCommand', command, null);
	});

	it('sends a seek in whole seconds, the unit the server reads', () => {
		engine.emit('seek', 95.6);

		expect(invoke).toHaveBeenCalledExactlyOnceWith('PlaybackCommand', 'seek', 96);
	});

	it('reports the position in seconds for the current track', () => {
		engine.emit('time', { currentTime: 42.5 });

		expect(invoke).toHaveBeenCalledExactlyOnceWith('CurrentTimeForItemCommand', 42.5, '4821');
	});
});
