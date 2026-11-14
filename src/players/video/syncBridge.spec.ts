import { afterEach, describe, expect, it, vi } from 'vitest';

import { videoSyncBridge } from './syncBridge';
import { socketStore } from '@/stores/socketStore';

type Handler = (data?: unknown) => void;

function fakeEngine() {
	const handlers = new Map<string, Handler[]>();
	return {
		on: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		}),
		off: vi.fn(),
		fire: (event: string, data?: unknown) => {
			for (const handler of handlers.get(event) ?? [])
				handler(data);
		},
		play: vi.fn(),
		pause: vi.fn(),
		time: vi.fn(),
		item: vi.fn(() => ({ id: 'a', videoId: 'v-1', type: 'tv', listId: 'l-1', tmdbId: 7 })),
		stop: vi.fn(),
		audioTrack: vi.fn(() => ({ index: 1, track: { language: 'eng' } })),
		subtitle: vi.fn(() => ({ index: 2, track: { language: 'nld', type: 'full' } })),
	};
}

describe('the sync bridge reads the 2.x payloads', () => {
	afterEach(() => {
		videoSyncBridge.detach();
		socketStore.videoHub.value = null;
	});

	it('sends SetTime with the time field of the time payload and the media id from item()', () => {
		const invoke = vi.fn();
		socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		engine.fire('time', { time: 61.4, position: 61.4, duration: 100 });

		expect(invoke).toHaveBeenCalledWith('SetTime', expect.objectContaining({
			VideoId: 'v-1',
			PlaylistType: 'tv',
			TmdbId: 7,
			Time: 61,
			Audio: 'eng',
			Subtitle: 'nld',
			SubtitleType: 'full',
		}));
	});

	it('maps an inbound Stop to stop() so playback ends', () => {
		const handlers = new Map<string, Handler>();
		socketStore.videoHub.value = { invoke: vi.fn(), on: (event: string, handler: Handler) => handlers.set(event, handler), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		handlers.get('Stop')!();

		expect(engine.stop).toHaveBeenCalledTimes(1);
		expect(engine.pause).not.toHaveBeenCalled();
	});

	it('sends the seek target from the seek payload', () => {
		const invoke = vi.fn();
		socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		engine.fire('seek', { time: 33 });

		expect(invoke).toHaveBeenCalledWith('PlaybackCommand', 'seek', { time: 33 });
	});

	// SignalR binds by argument count: VideoHub.PlaybackCommand(command, data) refuses one argument.
	it.each(['play', 'pause'])('sends %s with both hub arguments', (event) => {
		const invoke = vi.fn();
		socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		engine.fire(event);

		expect(invoke).toHaveBeenCalledWith('PlaybackCommand', event, null);
	});

	it('applies an inbound Seek with time() and not the removed seek()', () => {
		const handlers = new Map<string, Handler>();
		socketStore.videoHub.value = { invoke: vi.fn(), on: (event: string, handler: Handler) => handlers.set(event, handler), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		handlers.get('Seek')!({ time: 12 });

		expect(engine.time).toHaveBeenCalledWith(12);
	});
});
