import { describe, expect, it, vi } from 'vitest';
import { answerControl } from './controlChannel';
import type { ControlEngine } from './controlChannel';

function engine(overrides: Partial<ControlEngine> = {}) {
	const queue = [
		{
			id: 'e1',
			title: 'Episode one',
			show: 'Show',
			season: 1,
			episode: 1,
			image: '/a.jpg',
			duration: 1440,
		},
		{
			id: 'e2',
			title: 'Episode two',
			show: 'Show',
			season: 1,
			episode: 2,
			image: '/b.jpg',
			duration: 1500,
		},
	];

	return {
		playState: () => 'playing',
		time: vi.fn((s?: number) =>
			s === undefined
				? 61.5
				: Promise.resolve()) as ControlEngine['time'],
		duration: () => 1440,
		volume: vi.fn((v?: number) =>
			v === undefined
				? 40
				: Promise.resolve()) as ControlEngine['volume'],
		volumeState: () => 'unmuted',
		toggleMute: vi.fn(),
		item: () => queue[1],
		index: () => 1,
		queue: () => queue,
		seekToIndex: vi.fn(),
		play: vi.fn(async () => {}),
		pause: vi.fn(async () => {}),
		stop: vi.fn(async () => {}),
		next: vi.fn(async () => {}),
		previous: vi.fn(async () => {}),
		audioTracks: () => [{
			id: 'a0',
			label: 'English',
			language: 'en',
		}, {
			id: 'a1',
			label: 'Japanese',
			language: 'ja',
		}],
		audioTrack: vi.fn((i?: number) =>
			i === undefined
				? { index: 1 }
				: Promise.resolve()) as ControlEngine['audioTrack'],
		subtitles: () => [{
			id: 's0',
			label: 'English',
			language: 'en',
		}],
		subtitle: vi.fn((i?: number | null) =>
			i === undefined
				? null
				: Promise.resolve()) as ControlEngine['subtitle'],
		qualityLevels: () => [{
			label: '1080p',
			height: 1080,
			bitrate: 6000000,
		}, {
			label: '720p',
			height: 720,
			bitrate: 3000000,
		}],
		quality: vi.fn((i?: number | 'auto') =>
			i === undefined
				? 'auto'
				: undefined) as ControlEngine['quality'],
		...overrides,
	} as const satisfies ControlEngine;
}

describe('answerControl: the /v1 TV control contract over the Cast channel', () => {
	it('answers ping', async () => {
		expect(await answerControl({
			id: 1,
			method: 'GET',
			path: '/v1/ping',
		}, engine())).toEqual({
			id: 1,
			status: 200,
			body: { ok: true },
		});
	});

	it('answers 412 for the session while no player runs', async () => {
		expect((await answerControl({
			id: 2,
			method: 'GET',
			path: '/v1/session',
		}, null)).status).toBe(412);
	});

	it('reports the player state in the contract shape', async () => {
		const res = await answerControl({
			id: 3,
			method: 'GET',
			path: '/v1/session',
		}, engine());

		expect(res.status).toBe(200);

		expect(res.body).toMatchObject({
			playbackState: 'playing',
			positionMs: 61500,
			durationMs: 1440000,
			itemId: 'e2',
			itemKind: 'episode',
			itemTitle: 'Episode two',
			volume: 0.4,
			muted: false,
			playlistActiveIndex: 1,
			playlistLength: 2,
		});
	});

	it('lists tracks with the current selections', async () => {
		const res = await answerControl({
			id: 4,
			method: 'GET',
			path: '/v1/session/tracks',
		}, engine());

		expect(res.body).toEqual({
			audio: [{ label: 'English', language: 'en' }, { label: 'Japanese', language: 'ja' }],
			subtitle: [{ label: 'English', language: 'en' }],
			quality: [{
				label: '1080p',
				height: 1080,
				bitrate: 6000000,
			}, {
				label: '720p',
				height: 720,
				bitrate: 3000000,
			}],
			currentAudioIndex: 1,
			currentSubtitleIndex: -1,
			currentQualityIndex: 0,
		});
	});

	it('lists the playlist', async () => {
		const res = await answerControl({
			id: 5,
			method: 'GET',
			path: '/v1/session/playlist',
		}, engine());

		expect(res.body).toEqual({
			activeIndex: 1,
			items: [
				{
					id: 'e1',
					kind: 'episode',
					title: 'Episode one',
					showTitle: 'Show',
					season: 1,
					episode: 1,
					overview: '',
					durationMs: 1440000,
					posterUrl: '/a.jpg',
				},
				{
					id: 'e2',
					kind: 'episode',
					title: 'Episode two',
					showTitle: 'Show',
					season: 1,
					episode: 2,
					overview: '',
					durationMs: 1500000,
					posterUrl: '/b.jpg',
				},
			],
		});
	});

	it('runs every transport command and answers 204', async () => {
		const e = engine();

		for (const verb of ['play', 'pause', 'stop', 'next', 'previous'] as const) {
			expect((await answerControl({
				id: 6,
				method: 'POST',
				path: `/v1/session/transport/${verb}`,
			}, e)).status).toBe(204);

			expect(e[verb]).toHaveBeenCalled();
		}

		await answerControl({
			id: 7,
			method: 'POST',
			path: '/v1/session/transport/seek',
			body: { positionMs: 90000 },
		}, e);

		expect(e.time).toHaveBeenCalledWith(90);
	});

	it('sets, steps and mutes the volume', async () => {
		const e = engine();

		await answerControl({
			id: 8,
			method: 'PATCH',
			path: '/v1/session/volume',
			body: {
				level: 0.7,
				delta: 0,
				muted: false,
			},
		}, e);

		expect(e.volume).toHaveBeenCalledWith(70);

		await answerControl({
			id: 9,
			method: 'PATCH',
			path: '/v1/session/volume',
			body: {
				level: 0,
				delta: 0.1,
				muted: false,
			},
		}, e);

		expect(e.volume).toHaveBeenCalledWith(50);

		await answerControl({
			id: 10,
			method: 'PATCH',
			path: '/v1/session/volume',
			body: {
				level: 0,
				delta: 0,
				muted: true,
			},
		}, e);

		expect(e.toggleMute).toHaveBeenCalled();
	});

	it('picks audio, subtitle, quality and playlist item', async () => {
		const e = engine();

		await answerControl({
			id: 11,
			method: 'PATCH',
			path: '/v1/session/audio',
			body: { trackId: '0' },
		}, e);

		expect(e.audioTrack).toHaveBeenCalledWith(0);

		await answerControl({
			id: 12,
			method: 'PATCH',
			path: '/v1/session/subtitle',
			body: { trackId: '', enabled: false },
		}, e);

		expect(e.subtitle).toHaveBeenCalledWith(null);

		await answerControl({
			id: 13,
			method: 'PATCH',
			path: '/v1/session/subtitle',
			body: { trackId: '0', enabled: true },
		}, e);

		expect(e.subtitle).toHaveBeenCalledWith(0);

		await answerControl({
			id: 14,
			method: 'PATCH',
			path: '/v1/session/quality',
			body: { level: 'auto' },
		}, e);

		expect(e.quality).toHaveBeenCalledWith('auto');

		await answerControl({
			id: 15,
			method: 'PATCH',
			path: '/v1/session/playlist',
			body: { activeIndex: 0 },
		}, e);

		expect(e.seekToIndex).toHaveBeenCalledWith(0);
	});

	it('answers 404 for a path it does not serve', async () => {
		expect((await answerControl({
			id: 16,
			method: 'GET',
			path: '/v1/devices',
		}, engine())).status).toBe(404);
	});
});
