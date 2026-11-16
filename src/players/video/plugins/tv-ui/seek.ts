import type { KeyName } from './keys';

const FALLBACK_STEP_SECONDS = 10;
const CHAPTER_RESTART_THRESHOLD = 3;

export function canEnterSeekMode(duration: number): boolean {
	return duration > 0;
}

export function commitSeek(time: number, seek: (time: number) => void, clearOverrideTime: () => void, play: () => void): void {
	seek(time);
	clearOverrideTime();
	play();
}

export function cancelSeek(clearOverrideTime: () => void, play: () => void): void {
	clearOverrideTime();
	play();
}

// Sprite frame starts when the item has a sprite sheet, else one step every 10 s.
export function frameTimesFor(spriteStarts: number[] | undefined, duration: number): number[] {
	if (spriteStarts && spriteStarts.length > 0)
		return spriteStarts;
	if (duration <= 0)
		return [];
	return Array.from({ length: Math.floor(duration / FALLBACK_STEP_SECONDS) + 1 }, (_, index) => index * FALLBACK_STEP_SECONDS);
}

export function snapIndex(frameTimes: number[], time: number): number {
	let index = 0;
	frameTimes.forEach((start, i) => {
		if (start <= time)
			index = i;
	});
	return index;
}

export interface StripKeyResult {
	index: number;
	consumed: boolean;
	commit?: number;
	cancel?: true;
}

// TVSeekContainer.kt:139-178.
export function seekStripKey(frameTimes: number[], index: number, key: KeyName): StripKeyResult {
	const last = Math.max(frameTimes.length - 1, 0);
	switch (key) {
		case 'left': return { index: Math.max(index - 1, 0), consumed: true };
		case 'right': return { index: Math.min(index + 1, last), consumed: true };
		case 'center': {
			const time = frameTimes[index];
			return time === undefined ? { index, consumed: true } : { index, consumed: true, commit: time };
		}
		case 'up':
		case 'down':
		case 'back':
			return { index, consumed: true, cancel: true };
		default:
			return { index, consumed: false };
	}
}

// VideoChromeStoreAdapter.kt:195-219: chapter-aware rewind and forward.
export function chapterSeekTarget(chapterStarts: number[], now: number, forward: boolean, step: number): number {
	if (forward) {
		const next = chapterStarts.find(start => start > now + CHAPTER_RESTART_THRESHOLD);
		return next ?? now + step;
	}
	const current = [...chapterStarts].reverse().find(start => start <= now);
	if (current === undefined)
		return Math.max(now - step, 0);
	if (now - current > CHAPTER_RESTART_THRESHOLD)
		return current;
	return [...chapterStarts].reverse().find(start => start < current) ?? 0;
}
