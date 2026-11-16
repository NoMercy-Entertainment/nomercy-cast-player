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
		// The shape the server's /watch sends (read from a live playlist): snake_case, no camelCase twins.
		item: vi.fn(() => ({ id: 986190, video_id: 'v-1', playlist_type: 'tv', video_type: 'tv', playlist_id: 60808, tmdb_id: 7, season: 1, episode: 3 })),
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

		// cast#74: the server reads snake_case (VideoProgressRequest); PascalCase left video_id empty and was refused.
		const body = invoke.mock.calls.find(call => call[0] === 'SetTime')?.[1] as Record<string, unknown>;
		expect(body).toEqual(expect.objectContaining({
			video_id: 'v-1',
			playlist_type: 'tv',
			playlist_id: 60808,
			tmdb_id: 7,
			time: 61,
			audio: 'eng',
			subtitle: 'nld',
			subtitle_type: 'full',
		}));
		expect(Object.keys(body)).toEqual(expect.not.arrayContaining(['VideoId', 'Time']));
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
	it('sends the seek target as whole seconds, like app-web and KMP', async () => {
		const invoke = vi.fn(() => Promise.resolve({ ok: true }));
		socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		engine.fire('seek', { time: 33.6 });
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(invoke).toHaveBeenCalledWith('PlaybackCommand', 'seek', 34);
	});

	// SignalR binds by argument count: VideoHub.PlaybackCommand(command, data) refuses one argument.
	it.each(['play', 'pause'])('sends %s with both hub arguments', async (event) => {
		const invoke = vi.fn(() => Promise.resolve({ ok: true }));
		socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
		const engine = fakeEngine();
		videoSyncBridge.attach(engine as never);

		engine.fire(event);
		await new Promise(resolve => setTimeout(resolve, 0));

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
			const invoke = vi.fn((method: string) => (method === 'StartPlaybackCommand' ? Promise.resolve({ ok: true }) : Promise.reject(new Error('refused'))));
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

			expect(invoke).toHaveBeenCalledTimes(3);
			expect(caught()).toHaveLength(0);
		});
	});

	// cast-player#76: the server's in-memory player state is filled only by StartPlaybackCommand, and a seek saves progress to it.
	describe('the item start is reported before any command', () => {
		const flushAll = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
		const names = (invoke: ReturnType<typeof vi.fn>) => invoke.mock.calls.map(call => (call[0] === 'PlaybackCommand' ? `${call[0]}:${String(call[1])}` : String(call[0])));
		const hubWith = (invoke: ReturnType<typeof vi.fn>) => {
			socketStore.videoHub.value = { invoke, on: vi.fn(), off: vi.fn() } as never;
		};

		it('sends StartPlaybackCommand with the item\'s type, list id and id before the first seek', async () => {
			const invoke = vi.fn(() => Promise.resolve({ ok: true }));
			hubWith(invoke);
			const engine = fakeEngine();
			videoSyncBridge.attach(engine as never);

			engine.fire('seek', { time: 90 });
			await flushAll();

			expect(invoke.mock.calls[0]).toEqual(['StartPlaybackCommand', 'tv', 60808, 986190]);
			expect(names(invoke)).toEqual(['StartPlaybackCommand', 'PlaybackCommand:seek']);
		});

		it('reports a new item when the player starts it', async () => {
			const invoke = vi.fn(() => Promise.resolve({ ok: true }));
			hubWith(invoke);
			const engine = fakeEngine();
			videoSyncBridge.attach(engine as never);

			engine.fire('item');
			await flushAll();

			expect(invoke).toHaveBeenCalledWith('StartPlaybackCommand', 'tv', 60808, 986190);
		});

		it('sends a later seek on the same item once, without a second start', async () => {
			const invoke = vi.fn(() => Promise.resolve({ ok: true }));
			hubWith(invoke);
			const engine = fakeEngine();
			videoSyncBridge.attach(engine as never);
			engine.fire('seek', { time: 90 });
			await flushAll();

			engine.fire('seek', { time: 120 });
			await flushAll();

			expect(names(invoke)).toEqual(['StartPlaybackCommand', 'PlaybackCommand:seek', 'PlaybackCommand:seek']);
			expect(invoke).toHaveBeenLastCalledWith('PlaybackCommand', 'seek', 120);
		});

		it('reports the item again when the video hub connects again', async () => {
			const invoke = vi.fn(() => Promise.resolve({ ok: true }));
			hubWith(invoke);
			const engine = fakeEngine();
			videoSyncBridge.attach(engine as never);
			engine.fire('item');
			await flushAll();

			socketStore.announceVideoHubConnected();
			await flushAll();

			expect(names(invoke)).toEqual(['StartPlaybackCommand', 'StartPlaybackCommand']);
		});

		it('sends no seek for an item the server did not take', async () => {
			const invoke = vi.fn((method: string) => (method === 'StartPlaybackCommand' ? Promise.reject(new Error('refused')) : Promise.resolve({ ok: true })));
			hubWith(invoke);
			const engine = fakeEngine();
			videoSyncBridge.attach(engine as never);

			engine.fire('seek', { time: 90 });
			await flushAll();

			expect(names(invoke)).toEqual(['StartPlaybackCommand']);
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
