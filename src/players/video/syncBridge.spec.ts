import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { videoSyncBridge } from './syncBridge';
import { socketStore } from '@/stores/socketStore';
import { playbackStore } from '@/stores/playbackStore';
import { diagnosticsRing } from '@/lib/diagnostics/sink';

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

	// cast#73: the server binds an object argument to nothing and fails the call; app-web and KMP send whole seconds.
	it('sends the seek target as whole seconds, like app-web and KMP', () => {
		const invoke = vi.fn();
		socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		engine.fire('seek', { time: 33.6 });

		expect(invoke).toHaveBeenCalledWith('PlaybackCommand', 'seek', 34);
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

	// The server can refuse a command (cast-player#73). The refusal is recorded, never left unhandled.
	describe('a refused outbound command', () => {
		const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
		const caught = () => diagnosticsRing.snapshot().filter(entry => entry.code === 'ErrorCaught');

		beforeEach(() => {
			diagnosticsRing.clear();
		});

		it.each([
			['play', undefined, 'syncPlaybackCommand'],
			['pause', undefined, 'syncPlaybackCommand'],
			['seek', { time: 5 }, 'syncPlaybackCommand'],
			['time', { time: 61.4 }, 'syncSetTime'],
		])('records one line for a rejected %s and keeps the play state', async (event, payload, where) => {
			const invoke = vi.fn(() => Promise.reject(new Error('refused')));
			socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
			const engine = fakeEngine();
			videoSyncBridge.attach(engine as never);
			const before = playbackStore.video.playing.value;

			engine.fire(event, payload);
			await flush();

			expect(caught()).toHaveLength(1);
			expect(caught()[0].label).toContain(where);
			expect(playbackStore.video.playing.value).toBe(event === 'play' ? true : event === 'pause' ? false : before);
		});

		it('records nothing for a command the server accepted', async () => {
			const invoke = vi.fn(() => Promise.resolve({ ok: true }));
			socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
			const engine = fakeEngine();
			videoSyncBridge.attach(engine as never);

			engine.fire('pause');
			engine.fire('seek', { time: 5 });
			await flush();

			expect(invoke).toHaveBeenCalledTimes(2);
			expect(caught()).toHaveLength(0);
		});
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
