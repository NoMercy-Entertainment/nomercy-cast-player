import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseChapterFile, prepareChapterPlaylist, serializeChapters } from './chapterFile';

const oldFile = `WEBVTT\n\nChapter 1\n00:00:00 --> 00:00:47\nIntro\nChapter 2\n00:00:47 --> 00:02:16\nOP\n`;
const newFile = `WEBVTT\n\nChapter 1\n00:00:00 --> 00:00:47\nIntro\n\nChapter 2\n00:00:47 --> 00:02:16\nOP\n`;

describe('chapter file compatibility', () => {
	it.each([oldFile, newFile])('reads each timing line as a separate cue', (file) => {
		expect(parseChapterFile(file)).toEqual([
			{ start: 0, end: 47, title: 'Intro' },
			{ start: 47, end: 136, title: 'OP' },
		]);
		expect(serializeChapters(parseChapterFile(file))).toContain('Intro\n\nChapter 2');
	});
});

describe('the chapter file the media server names', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('is fetched from the signed-in server when its path is relative', async () => {
		const fetchMock = vi.fn(async () => new Response(newFile));
		vi.stubGlobal('fetch', fetchMock);
		const item = { id: '1', title: 'One', tracks: [{ kind: 'chapters', file: '/library/one/chapters.vtt' }] };

		await prepareChapterPlaylist([item], 'placeholder-token', 'https://192-0-2-10.example.invalid:7626');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://192-0-2-10.example.invalid:7626/library/one/chapters.vtt',
			{ headers: { Authorization: 'Bearer placeholder-token' } },
		);
	});
});
