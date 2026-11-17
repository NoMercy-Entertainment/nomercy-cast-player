import { describe, expect, it, vi } from 'vitest';
import { handleMusicMediaKey } from './mediaKeys';

function engine() {
	return {
		play: vi.fn(),
		pause: vi.fn(),
		next: vi.fn(),
		previous: vi.fn(),
	};
}

function key(name: string, prevented = false): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key: name, cancelable: true });

	if (prevented) {
		event.preventDefault();
	}

	return event;
}

// KMP answers media keys app-wide through its media session; music had no handler at all.
describe('the remote media keys drive music anywhere in the app', () => {
	it('play-pause pauses a playing track and plays a paused one', () => {
		const e = engine();

		expect(handleMusicMediaKey(key('MediaPlayPause'), e, true)).toBe(true);
		expect(handleMusicMediaKey(key('MediaPlayPause'), e, false)).toBe(true);
		expect([e.pause, e.play].map((fn) => fn.mock.calls.length)).toEqual([1, 1]);
	});

	it('play, pause, next, previous and stop each do their own verb', () => {
		const e = engine();

		for (const name of ['MediaPlay', 'MediaPause', 'MediaTrackNext', 'MediaTrackPrevious', 'MediaStop']) {
			handleMusicMediaKey(key(name), e, true);
		}

		const calls = [e.play, e.pause, e.next, e.previous].map((fn) => fn.mock.calls.length);

		expect(calls).toEqual([1, 2, 1, 1]);
	});

	it('leaves a key the video player took, and every key when no music engine runs', () => {
		const e = engine();

		expect(handleMusicMediaKey(key('MediaPlayPause', true), e, true)).toBe(false);
		expect(handleMusicMediaKey(key('MediaPlayPause'), null, true)).toBe(false);
		expect(handleMusicMediaKey(key('ArrowLeft'), e, true)).toBe(false);
		expect(e.pause).not.toHaveBeenCalled();
	});
});
