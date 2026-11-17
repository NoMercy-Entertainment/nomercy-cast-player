import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import { dispatchInitialIntent } from './navStore';
import { socketStore } from './socketStore';

describe('navStore.dispatchInitialIntent', () => {
	it('carries a series episode and resume position into the watch route', () => {
		const push = vi.fn();

		dispatchInitialIntent({
			type: 'play_video',
			media_type: 'tv',
			media_id: '42',
			season: 1,
			episode: 3,
			resume_at: 90,
		}, { push } as unknown as Router);

		expect(push).toHaveBeenCalledWith({ path: '/tv/42/watch', query: {
			season: '1',
			episode: '3',
			resume_at: '90',
		} });
	});

	it('carries the audio and subtitle the phone showed into the watch route', () => {
		const push = vi.fn();

		dispatchInitialIntent({
			type: 'play_video',
			media_type: 'tv',
			media_id: '82684',
			resume_at: 1171,
			audio_language: 'eng',
			subtitle_language: 'eng',
			subtitle_type: 'full',
			subtitle_codec: 'ass',
		}, { push } as unknown as Router);

		expect(push).toHaveBeenCalledWith({
			path: '/tv/82684/watch',
			query: {
				resume_at: '1171',
				audio: 'eng',
				subtitle: 'eng',
				subtitleType: 'full',
				subtitleFormat: 'ass',
			},
		});
	});

	it('sends no language query when the intent carries none', () => {
		const push = vi.fn();

		dispatchInitialIntent({
			type: 'play_video',
			media_type: 'movie',
			media_id: '603',
		}, { push } as unknown as Router);

		expect(push).toHaveBeenCalledWith({ path: '/movie/603/watch', query: undefined });
	});
});

// TV log 2026-11-17 03:57-03:59: three music casts from the browser launched
// this receiver and none played. CastToNearby only launches the receiver; the
// browser releases the session, and nothing on the receiver took it up.
describe('navStore.dispatchInitialIntent play_music', () => {
	const invoke = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
	const handlers = new Map<string, (payload: unknown) => void>();

	// The state MusicHub pushes 500 ms after this receiver's music hub connects.
	function serverPushes(state: Record<string, unknown>): void {
		handlers.get('MusicPlayerState')?.({ events: [{ type: 'PlayerStateChanged', event: { state } }] });
	}

	beforeEach(() => {
		invoke.mockClear();
		handlers.clear();

		socketStore.musicHub.value = {
			invoke,
			on: (event: string, handler: (payload: unknown) => void) => handlers.set(event, handler),
			off: (event: string) => handlers.delete(event),
		} as never;
	});

	afterEach(() => {
		socketStore.musicHub.value = null;
	});

	const musicIntent = {
		type: 'play_music',
		list_type: 'album',
		list_id: '460c43b3-7b72-484a-b9dc-223c4aaf5644',
		track_id: '0b3d1c2e-1f00-4e7a-9a55-6c1d2b3a4f50',
		resume_at: 42,
	} as const;
	const track = { id: musicIntent.track_id, path: '/a.mp3' };

	it('plays the released session here, which makes this receiver the active device', async () => {
		dispatchInitialIntent(musicIntent, { push: vi.fn() } as unknown as Router);

		serverPushes({
			device_id: null,
			is_playing: false,
			item: track,
		});

		await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

		expect(invoke.mock.calls).toEqual([['PlaybackCommand', 'play', null]]);
	});

	it('sends nothing while another device still owns the session, so its audio stays as it is', async () => {
		dispatchInitialIntent(musicIntent, { push: vi.fn() } as unknown as Router);

		serverPushes({
			device_id: 'browser-1',
			is_playing: false,
			item: track,
		});

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(invoke).not.toHaveBeenCalled();
	});

	it('starts the cast list when the server holds no session', async () => {
		dispatchInitialIntent(musicIntent, { push: vi.fn() } as unknown as Router);
		serverPushes({});

		await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

		expect(invoke.mock.calls).toEqual([
			['StartPlaybackCommand', 'album', musicIntent.list_id, musicIntent.track_id],
		]);
	});

	it('acts on the first state only', async () => {
		dispatchInitialIntent(musicIntent, { push: vi.fn() } as unknown as Router);

		serverPushes({
			device_id: null,
			is_playing: false,
			item: track,
		});

		serverPushes({
			device_id: null,
			is_playing: false,
			item: track,
		});

		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(invoke).toHaveBeenCalledTimes(1);
	});
});
