// The bridge reports the receiver's music engine to the server's MusicHub. Each
// call must name a method the hub has, with the arguments it reads:
// PlaybackCommand(command, data) and CurrentTimeForItemCommand(seconds, itemId).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { castDeviceId } from '@/lib/diagnostics/deviceId';
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
	const invoke = vi.fn(async (..._args: unknown[]) => undefined);
	const hubHandlers = new Map<string, (...args: unknown[]) => void>();
	let engine: ReturnType<typeof fakeEngine>;

	// What the server pushes after every change: who the active device is.
	function serverNamesActive(deviceId: string | null): void {
		hubHandlers.get('MusicPlayerState')?.({ device_id: deviceId });
	}

	beforeEach(() => {
		invoke.mockClear();
		hubHandlers.clear();
		socketStore.musicHub.value = {
			invoke,
			on: (event: string, handler: (...args: unknown[]) => void) => hubHandlers.set(event, handler),
			off: () => {},
		} as never;
		engine = fakeEngine();
		musicSyncBridge.attach(engine as never);
	});

	afterEach(() => {
		musicSyncBridge.detach();
		socketStore.musicHub.value = null as never;
	});

	it.each(['play', 'pause', 'next', 'previous'])('sends %s as a PlaybackCommand while this receiver is the active device', (command) => {
		serverNamesActive(castDeviceId());
		engine.emit(command);

		expect(invoke).toHaveBeenCalledExactlyOnceWith('PlaybackCommand', command, null);
	});

	it('sends a seek in whole seconds, the unit the server reads', () => {
		serverNamesActive(castDeviceId());
		engine.emit('seek', 95.6);

		expect(invoke).toHaveBeenCalledExactlyOnceWith('PlaybackCommand', 'seek', 96);
	});

	// PlaybackCommand applies to the user's one music session from any caller,
	// so a passive receiver's play would start the active phone's audio.
	it.each([['another device', 'phone-1'], ['no device', null]])('sends no command while the server names %s', (_, active) => {
		serverNamesActive(active);
		engine.emit('play');
		engine.emit('pause');

		expect(invoke.mock.calls.filter(([method]) => method === 'PlaybackCommand')).toEqual([]);
	});

	it('sends no command before the server has named an active device', () => {
		engine.emit('play');

		expect(invoke).not.toHaveBeenCalled();
	});

	// The audio element fires pause when a track runs out, before the next one
	// starts; that is not the user pausing.
	it('sends no pause when the track has ended', () => {
		serverNamesActive(castDeviceId());
		engine.emit('pause', { ended: true });

		expect(invoke).not.toHaveBeenCalled();
	});

	it('reports the position in seconds for the current track', () => {
		engine.emit('time', { currentTime: 42.5 });

		expect(invoke).toHaveBeenCalledExactlyOnceWith('CurrentTimeForItemCommand', 42.5, '4821');
	});
});
