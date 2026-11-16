import { describe, expect, it } from 'vitest';
import { fromEngineStyle, isPlaying, readVolume, toEngineStyle } from './engine';
import { parseSpriteVtt, frameAt } from './sprite';
import { showBackdrop, showLoading } from './overlays';

describe('engine accessors of nomercy-video-player 2.8.3', () => {
	it('isPlaying reads playState(), the player has no paused()', () => {
		expect(isPlaying({ playState: () => 'playing' })).toBe(true);
		expect(isPlaying({ playState: () => 'paused' })).toBe(false);
		expect(isPlaying({ playState: () => 'loading' })).toBe(false);
	});

	it('readVolume maps volume() 0-100 and volumeState() to level and muted', () => {
		expect(readVolume({ volume: () => 50, volumeState: () => 'unmuted' })).toEqual({ level: 0.5, muted: false });
		expect(readVolume({ volume: () => 80, volumeState: () => 'muted' })).toEqual({ level: 0.8, muted: true });
	});

	it('toEngineStyle maps the KMP style names to SubtitleStyle fields', () => {
		expect(toEngineStyle({ fontSize: 36 })).toEqual({ fontSize: 150 });
		expect(toEngineStyle({ edgeStyle: 'drop_shadow' })).toEqual({ edgeStyle: 'dropShadow' });
		expect(toEngineStyle({ edgeStyle: 'text_shadow' })).toEqual({ edgeStyle: 'textShadow' });
		expect(toEngineStyle({ fontColor: 'yellow' })).toEqual({ textColor: 'yellow' });
		expect(toEngineStyle({ backgroundOpacity: 0.5 })).toEqual({ backgroundOpacity: 50 });
		expect(toEngineStyle({ fontFamily: 'Arial, sans-serif' })).toEqual({ fontFamily: 'Arial, sans-serif' });
	});

	it('fromEngineStyle is the inverse for the settings rows', () => {
		const view = fromEngineStyle({ fontSize: 150, fontFamily: 'Arial, sans-serif', textColor: 'yellow', backgroundOpacity: 50, edgeStyle: 'dropShadow' });
		expect(view).toEqual({ fontSize: 36, fontFamily: 'Arial, sans-serif', fontColor: 'yellow', backgroundOpacity: 0.5, edgeStyle: 'drop_shadow' });
	});
});

describe('scrub sprite (TVSeekContainer.kt:61-121, PreviewThumbnailsPlugin.kt)', () => {
	const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:10.000\nsprite.webp#xywh=0,0,320,180\n\n00:00:10.000 --> 00:00:20.000\nsprite.webp#xywh=320,0,320,180\n';

	it('parses the cue file into frames against the base url', () => {
		const cues = parseSpriteVtt(vtt, 'https://server.example.test/media/a/thumbs.vtt');
		expect(cues).toHaveLength(2);
		expect(cues[1]).toEqual({ start: 10, end: 20, x: 320, y: 0, w: 320, h: 180, url: 'https://server.example.test/media/a/sprite.webp' });
	});

	it('frameAt returns the cue covering the time, the last one past the end', () => {
		const cues = parseSpriteVtt(vtt, 'https://server.example.test/a/t.vtt');
		expect(frameAt(cues, 12)?.x).toBe(320);
		expect(frameAt(cues, 99)?.x).toBe(320);
		expect(frameAt([], 1)).toBeNull();
	});
});

describe('backdrop and loading overlay predicates (TvUiPlugin.kt:630, :668)', () => {
	it('the backdrop shows before the first frame and never over the pre-screen', () => {
		expect(showBackdrop({ preScreen: false, duration: 0, time: 0 })).toBe(true);
		expect(showBackdrop({ preScreen: false, duration: 100, time: 0 })).toBe(true);
		expect(showBackdrop({ preScreen: false, duration: 100, time: 5 })).toBe(false);
		expect(showBackdrop({ preScreen: true, duration: 0, time: 0 })).toBe(false);
	});

	it('the loading overlay shows without duration, or at time 0 while not playing', () => {
		expect(showLoading({ preScreen: false, duration: 0, time: 0, playing: false })).toBe(true);
		expect(showLoading({ preScreen: false, duration: 100, time: 0, playing: false })).toBe(true);
		expect(showLoading({ preScreen: false, duration: 100, time: 0, playing: true })).toBe(false);
		expect(showLoading({ preScreen: true, duration: 0, time: 0, playing: false })).toBe(false);
	});
});
