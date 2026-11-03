import { describe, expect, it } from 'vitest';
import { parseChapterFile, serializeChapters } from './chapterFile';

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
