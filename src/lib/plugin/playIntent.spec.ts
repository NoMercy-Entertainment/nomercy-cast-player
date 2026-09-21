import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import type { PluginMediaRef } from './mediaRef';
import type { PluginPlayEngine, PluginPlayEngines } from './playIntent';

import { playPluginMedia } from './playIntent';

interface SpyEngine extends PluginPlayEngine {
	play: Mock<() => void>;
	loadTrack: Mock<(data: unknown) => void>;
	loadPlaylist: Mock<(playlist: unknown, item?: unknown) => void>;
}

function engine(): SpyEngine {
	return {
		play: vi.fn<() => void>(),
		loadTrack: vi.fn<(data: unknown) => void>(),
		loadPlaylist: vi.fn<(playlist: unknown, item?: unknown) => void>(),
	};
}

function both(): PluginPlayEngines & { musicEngine: SpyEngine; videoEngine: SpyEngine } {
	const musicEngine = engine();
	const videoEngine = engine();

	return {
		musicEngine,
		videoEngine,
		music: () => musicEngine,
		video: () => videoEngine,
	};
}

function media(over: Partial<PluginMediaRef> = {}): PluginMediaRef {
	return {
		pluginId: 'radio',
		mediaId: 'station-1',
		kind: 'audio',
		live: true,
		url: 'https://host.example/plugin/radio/station-1.m3u8',
		title: 'Night Shift',
		artist: 'Radio Nine',
		cover: null,
		...over,
	};
}

describe('playPluginMedia', () => {
	it('sends audio to the music engine and nothing to the video one', () => {
		const engines = both();

		expect(playPluginMedia(media(), engines)).toBe('music');
		expect(engines.musicEngine.loadTrack).toHaveBeenCalledTimes(1);
		expect(engines.videoEngine.loadPlaylist).not.toHaveBeenCalled();
	});

	it('sends video to the video engine and nothing to the music one', () => {
		const engines = both();

		expect(playPluginMedia(media({ kind: 'video', live: false }), engines)).toBe('video');
		expect(engines.videoEngine.loadPlaylist).toHaveBeenCalledTimes(1);
		expect(engines.musicEngine.loadTrack).not.toHaveBeenCalled();
	});

	it('asks the engine to play once the media is loaded', () => {
		const engines = both();

		playPluginMedia(media(), engines);

		expect(engines.musicEngine.play).toHaveBeenCalledTimes(1);
	});

	it('loads the frame item the shared mapping built, not the raw reference', () => {
		const engines = both();

		playPluginMedia(media(), engines);

		expect(engines.musicEngine.loadTrack).toHaveBeenCalledWith({
			id: 'plugin:radio:station-1',
			name: 'Night Shift',
			path: 'https://host.example/plugin/radio/station-1.m3u8',
			cover: null,
			plugin_id: 'radio',
			live: true,
		});
	});

	it('plays nothing at all when the url carries a credential', () => {
		const engines = both();

		const outcome = playPluginMedia(
			media({ url: 'https://host.example/s.m3u8?token=abc' }),
			engines,
		);

		expect(outcome).toBe('refused');
		expect(engines.musicEngine.loadTrack).not.toHaveBeenCalled();
		expect(engines.musicEngine.play).not.toHaveBeenCalled();
		expect(engines.videoEngine.loadPlaylist).not.toHaveBeenCalled();
	});

	it('reports an absent engine instead of throwing', () => {
		const engines: PluginPlayEngines = { music: () => null, video: () => null };

		expect(playPluginMedia(media(), engines)).toBe('unavailable');
		expect(playPluginMedia(media({ kind: 'video' }), engines)).toBe('unavailable');
	});
});
