import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachChapterAutoSkip, detachChapterAutoSkip, setAutoSkipEnabled } from './ChapterAutoSkipPlugin';

interface Chapter { index: number; title: string; start: number; end: number }

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
		time: vi.fn((to?: number) => to === undefined ? time : undefined),
		item: () => undefined,
		chapters: () => chapters,
		setTime(t: number) {
			time = t;
			for (const handler of [...(handlers.get('time') ?? [])])
				handler(undefined);
		},
		seekTo(t: number) {
			time = t;
			this.emit('seek', t);
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
			{ index: 0, title: 'Intro', start: 0, end: 10 },
			{ index: 1, title: 'Chapter 2', start: 10, end: 100 },
		]);
		attachChapterAutoSkip(player as never);

		player.setTime(5);
		expect(player.emit).toHaveBeenCalledWith('chapter-skip-available', expect.objectContaining({ id: 'chapter-0', type: 'intro', endTime: 10 }));

		player.setTime(15);
		expect(player.emit).toHaveBeenCalledWith('chapter-skip-clear');
	});

	it('clears the prompt on seek, including when the destination has no chapter', () => {
		const player = fakePlayer([{ index: 0, title: 'Intro', start: 0, end: 10 }]);
		attachChapterAutoSkip(player as never);
		player.setTime(5);
		player.seekTo(20);
		expect(player.emit).toHaveBeenCalledWith('chapter-skip-clear');
	});
});
