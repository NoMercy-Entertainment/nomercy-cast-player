import { describe, expect, it, vi } from 'vitest';
import { cancelSeek, canEnterSeekMode, chapterSeekTarget, commitSeek, frameTimesFor, seekStripKey, snapIndex } from './seek';

describe('tvSeekActions (TvSeekActions.kt:11-35)', () => {
	it('canEnterSeekMode needs a known duration', () => {
		expect(canEnterSeekMode(0)).toBe(false);
		expect(canEnterSeekMode(90)).toBe(true);
	});

	it('commit seeks, clears the override time and plays, in that order', () => {
		const calls: string[] = [];
		commitSeek(42, t => calls.push(`seek ${t}`), () => calls.push('clear'), () => calls.push('play'));
		expect(calls).toEqual(['seek 42', 'clear', 'play']);
	});

	it('cancel clears the override time and plays', () => {
		const clear = vi.fn();
		const play = vi.fn();
		cancelSeek(clear, play);
		expect(clear).toHaveBeenCalledOnce();
		expect(play).toHaveBeenCalledOnce();
	});
});

describe('scrub strip (TVSeekContainer.kt)', () => {
	const times = [0, 10, 20, 30];

	it('s07 steps every 10 seconds when the item has no sprite', () => {
		expect(frameTimesFor(undefined, 25)).toEqual([0, 10, 20]);
		expect(frameTimesFor([5, 15], 25)).toEqual([5, 15]);
		expect(frameTimesFor(undefined, 0)).toEqual([]);
	});

	it('s06 snaps to the last frame at or before the playhead', () => {
		expect(snapIndex(times, 25)).toBe(2);
		expect(snapIndex(times, -1)).toBe(0);
	});

	it('s01 left steps back and stops at the first frame', () => {
		expect(seekStripKey(times, 2, 'left')).toEqual({ index: 1, consumed: true });
		expect(seekStripKey(times, 0, 'left')).toEqual({ index: 0, consumed: true });
	});

	it('s02 right steps on and stops at the last frame', () => {
		expect(seekStripKey(times, 2, 'right')).toEqual({ index: 3, consumed: true });
		expect(seekStripKey(times, 3, 'right')).toEqual({ index: 3, consumed: true });
	});

	it('s03 center commits the selected frame time', () => {
		expect(seekStripKey(times, 2, 'center')).toEqual({ index: 2, consumed: true, commit: 20 });
	});

	it.each(['up', 'down', 'back'] as const)('s04 %s cancels', (key) => {
		expect(seekStripKey(times, 2, key)).toEqual({ index: 2, consumed: true, cancel: true });
	});

	it('s05 any other key is not handled', () => {
		expect(seekStripKey(times, 2, 'other')).toEqual({ index: 2, consumed: false });
	});
});

describe('chapter-aware seek (VideoChromeStoreAdapter.kt:195-219)', () => {
	const starts = [0, 100, 200];

	it('h02 backward inside the first seconds of a chapter jumps to the previous chapter', () => {
		expect(chapterSeekTarget(starts, 101, false, 10)).toBe(0);
	});

	it('h02 backward later in a chapter restarts that chapter', () => {
		expect(chapterSeekTarget(starts, 150, false, 10)).toBe(100);
	});

	it('h03 forward goes to the next chapter start past the restart threshold', () => {
		expect(chapterSeekTarget(starts, 150, true, 10)).toBe(200);
	});

	it('h03 without chapters a step on or back, never below zero', () => {
		expect(chapterSeekTarget([], 50, true, 10)).toBe(60);
		expect(chapterSeekTarget([], 4, false, 10)).toBe(0);
	});

	it('h03 forward past the last chapter steps on', () => {
		expect(chapterSeekTarget(starts, 250, true, 10)).toBe(260);
	});
});
