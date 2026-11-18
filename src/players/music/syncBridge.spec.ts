// The bridge reports the receiver's music engine to the server's MusicHub. Each
// call must name a method the hub has, with the arguments it reads:
// PlaybackCommand(command, data) and CurrentTimeForItemCommand(seconds, itemId).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
			const kept = (handlers.get(event) ?? []).filter((entry) => handler && entry !== handler);

			handlers.set(event, kept);
		},
		emit(event: string, payload?: unknown) {
			for (const handler of [...(handlers.get(event) ?? [])]) {
				handler(payload);
			}
		},
		play: () => {},
		pause: () => {},
		next: () => {},
		previous: () => {},
		seek: () => {},
		currentTrack: () => ({ id: 4821 }),
		volume: vi.fn(),
		shuffle: vi.fn(),
		repeat: vi.fn(),
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

	it('reads the active device from a MusicPlayerState envelope', () => {
		hubHandlers.get('MusicPlayerState')?.({ events: [{ type: 'PlayerStateChanged', event: { state: { device_id: castDeviceId() } } }] });
		engine.emit('play');
		expect(invoke).toHaveBeenCalledExactlyOnceWith('PlaybackCommand', 'play', null);
	});

	// MusicPlayerFacade.shuffle: the active device flips its own player; a passive one forwards the verb.
	it('music-19: shuffle on the active device flips the engine', () => {
		serverNamesActive(castDeviceId());
		musicSyncBridge.setShuffle(true);

		expect(engine.shuffle).toHaveBeenCalledExactlyOnceWith(true);
		expect(invoke).not.toHaveBeenCalled();
	});

	it('music-19: shuffle on a passive device sends the shuffle verb to the active one', () => {
		serverNamesActive('phone-1');
		musicSyncBridge.setShuffle(true);

		expect(engine.shuffle).not.toHaveBeenCalled();
		expect(invoke).toHaveBeenCalledExactlyOnceWith('PlaybackCommand', 'shuffle', null);
	});

	// MusicPlaybackCommandHandler.cs:66-69: the server's repeat verb ignores its data and cycles the mode.
	it('repeat on the active device sets the engine mode', () => {
		serverNamesActive(castDeviceId());
		musicSyncBridge.setRepeat('all');

		expect(engine.repeat).toHaveBeenCalledExactlyOnceWith('all');
		expect(invoke).not.toHaveBeenCalled();
	});

	it('repeat on a passive device sends the repeat verb to the active one', () => {
		serverNamesActive('phone-1');
		musicSyncBridge.setRepeat('all');

		expect(engine.repeat).not.toHaveBeenCalled();
		expect(invoke).toHaveBeenCalledExactlyOnceWith('PlaybackCommand', 'repeat', null);
	});

	it('the repeat button goes through the bridge like the shuffle button', () => {
		const file = resolve(process.cwd(), 'src/players/music/ProgressControls.vue');
		const source = readFileSync(file, 'utf8');

		expect(source).toContain('musicSyncBridge.setRepeat(');
		expect(source).not.toContain('playbackStore.music.applyRepeat(');
	});

	it('music-02: binds to a music hub that arrives after attach and to a replaced hub', () => {
		const playTrack = vi.fn();
		const late = fakeEngine();
		const lateHandlers = new Map<string, (...args: unknown[]) => void>();
		const hubFor = (handlers: Map<string, (...args: unknown[]) => void>) => ({
			invoke,
			on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
			off: (event: string) => handlers.delete(event),
		}) as never;
		const state = {
			device_id: castDeviceId(),
			is_playing: true,
			item: { id: 'a', path: '/a.mp3' },
		};

		musicSyncBridge.detach();
		socketStore.musicHub.value = null as never;
		musicSyncBridge.attach({ ...late, playTrack } as never);

		socketStore.musicHub.value = hubFor(lateHandlers);
		lateHandlers.get('MusicPlayerState')?.(state);
		expect(playTrack).toHaveBeenCalledTimes(1);

		const replaced = new Map<string, (...args: unknown[]) => void>();

		socketStore.musicHub.value = hubFor(replaced);
		expect(lateHandlers.has('MusicPlayerState')).toBe(false);
		replaced.get('MusicPlayerState')?.({ ...state, item: { id: 'b', path: '/b.mp3' } });
		expect(playTrack).toHaveBeenCalledTimes(2);
	});

	it('subscribes only to server events that MusicHub actually pushes', () => {
		expect([...hubHandlers.keys()]).toEqual(['MusicPlayerState', 'ConnectedDevicesState']);
	});

	// The audio element fires pause when a track runs out, before the next one
	// starts; that is not the user pausing.
	it('sends no pause when the track has ended', () => {
		serverNamesActive(castDeviceId());
		engine.emit('pause', { ended: true });

		expect(invoke).not.toHaveBeenCalled();
	});

	// The server stamps every device's level into device_volumes; the receiver
	// plays at its own entry, not at a sibling device's.
	it('applies its own device_volumes entry from the state envelope', () => {
		const state = { device_volumes: { [castDeviceId()]: 35, 'phone-1': 80 } };

		hubHandlers.get('MusicPlayerState')?.({ events: [{ type: 'PlayerStateChanged', event: { state } }] });

		expect(engine.volume).toHaveBeenCalledExactlyOnceWith(35);
	});

	it('leaves the volume alone when the state has no entry for this receiver', () => {
		hubHandlers.get('MusicPlayerState')?.({ events: [{ event: { state: { device_volumes: { 'phone-1': 80 } } } }] });

		expect(engine.volume).not.toHaveBeenCalled();
	});

	it('reports the position in seconds for the current track', () => {
		engine.emit('time', { currentTime: 42.5 });

		expect(invoke).toHaveBeenCalledExactlyOnceWith('CurrentTimeForItemCommand', 42.5, '4821');
	});
});

// The audio engine is a plain local player: nothing loads the server's track
// into it. When the server names this receiver, the bridge must load, seek and
// play the track, or the screen shows a song that makes no sound.
describe('musicSyncBridge when the server names this receiver', () => {
	const hubHandlers = new Map<string, (...args: unknown[]) => void>();
	const invoke = vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined);
	const track = (id: string) => ({
		id,
		path: `/music/${id}.flac`,
	});
	const item = track('track-a');
	const next = track('track-b');
	const trackEngine = () => ({
		...fakeEngine(),
		playTrack: vi.fn<(track: unknown, tracks?: unknown[]) => void>(),
		play: vi.fn<() => void>(),
		pause: vi.fn<() => void>(),
		seek: vi.fn<(seconds: number) => void>(),
		currentSong: null as { id: string } | null,
	});
	let engine: ReturnType<typeof trackEngine>;

	function push(device: string, extra: Record<string, unknown> = {}): void {
		const state = {
			device_id: device,
			is_playing: true,
			item,
			playlist: [],
			progress_ms: 0,
			...extra,
		};

		hubHandlers.get('MusicPlayerState')?.({ events: [{ type: 'PlayerStateChanged', event: { state } }] });
	}

	beforeEach(() => {
		invoke.mockClear();
		hubHandlers.clear();

		socketStore.musicHub.value = {
			invoke,
			on: (event: string, handler: (...args: unknown[]) => void) => hubHandlers.set(event, handler),
			off: () => {},
		} as never;

		engine = trackEngine();
		musicSyncBridge.attach(engine as never);
	});

	afterEach(() => {
		musicSyncBridge.detach();
		socketStore.musicHub.value = null as never;
	});

	it('loads the track with its queue, then seeks and plays once it can play', () => {
		push(castDeviceId(), { playlist: [item, next], progress_ms: 24000 });

		expect(engine.playTrack).toHaveBeenCalledExactlyOnceWith(item, [item, next]);

		engine.emit('canplay');

		expect(engine.seek).toHaveBeenCalledExactlyOnceWith(24);
		expect(engine.play).toHaveBeenCalledOnce();
	});

	it('leaves the loaded track paused when the session is paused', () => {
		push(castDeviceId(), { is_playing: false, playlist: [next] });
		engine.emit('canplay');

		expect(engine.playTrack).toHaveBeenCalledExactlyOnceWith(item, [item, next]);
		expect(engine.pause).toHaveBeenCalledOnce();
		expect(engine.play).not.toHaveBeenCalled();
	});

	it('does not reload the track the engine already holds', () => {
		engine.currentSong = { id: 'track-a' };
		push(castDeviceId(), { progress_ms: 1000 });

		expect(engine.playTrack).not.toHaveBeenCalled();
		expect(engine.play).toHaveBeenCalledOnce();
	});

	it('loads nothing while another device is active', () => {
		push('phone-1');

		expect(engine.playTrack).not.toHaveBeenCalled();
	});

	it('pauses when the server hands playback to another device', () => {
		push(castDeviceId());
		push('phone-1');

		expect(engine.pause).toHaveBeenCalledOnce();
	});

	it('does not report the pause the engine fires while it swaps the track', () => {
		push(castDeviceId());
		engine.emit('pause');

		expect(invoke).not.toHaveBeenCalled();
	});
});
