import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachChapterAutoSkip, detachChapterAutoSkip, setAutoSkipEnabled } from './ChapterAutoSkipPlugin';

interface Chapter { id: string; type?: string; startTime?: number; endTime?: number }

function fakePlayer(chapters: Chapter[]) {
	const handlers = new Map<string, Array<(data: unknown) => void>>();
	let time = 0;

	return {
		on(event: string, handler: (data: unknown) => void) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		off(event: string, handler?: (data: unknown) => void) {
			handlers.set(event, (handlers.get(event) ?? []).filter(entry => handler && entry !== handler));
		},
		emit: vi.fn((event: string, payload?: unknown) => {
			for (const handler of [...(handlers.get(event) ?? [])])
				handler(payload);
		}),
		currentTime: () => time,
		chapter: (t: number) => chapters.find(c => (c.startTime ?? 0) <= t && t < (c.endTime ?? Number.POSITIVE_INFINITY)) ?? null,
		seek: vi.fn(),
		setTime(t: number) {
			time = t;
			for (const handler of [...(handlers.get('time') ?? [])])
				handler(undefined);
		},
	};
}

describe('chapterAutoSkipPlugin clears the skip prompt once the chapter ends', () => {
	afterEach(() => {
		detachChapterAutoSkip();
		setAutoSkipEnabled(false);
	});

	it('emits chapter-skip-clear when the playhead leaves the intro chapter', () => {
		const player = fakePlayer([
			{ id: 'intro', type: 'intro', startTime: 0, endTime: 10 },
			{ id: 'main', type: undefined, startTime: 10, endTime: 100 },
		]);
		attachChapterAutoSkip(player as never);

		player.setTime(5);
		expect(player.emit).toHaveBeenCalledWith('chapter-skip-available', expect.objectContaining({ id: 'intro' }));

		player.setTime(15);
		expect(player.emit).toHaveBeenCalledWith('chapter-skip-clear');
	});
});
