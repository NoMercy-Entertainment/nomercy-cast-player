import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseChapterFile, prepareChapterPlaylist } from './chapterFile';

const oldFile = `WEBVTT\n\nChapter 1\n00:00:00 --> 00:00:47\nIntro\nChapter 2\n00:00:47 --> 00:02:16\nOP\n`;
const newFile = `WEBVTT\n\nChapter 1\n00:00:00 --> 00:00:47\nIntro\n\nChapter 2\n00:00:47 --> 00:02:16\nOP\n`;
const noIds = `WEBVTT\n\n00:00:00.000 --> 00:00:47.500\nIntro\n00:00:47.500 --> 00:02:16.000\nOP\n`;
const chapters = [
	{
		index: 0,
		start: 0,
		end: 47,
		title: 'Intro',
	},
	{
		index: 1,
		start: 47,
		end: 136,
		title: 'OP',
	},
];

function itemWithChapterTrack(file: string) {
	return {
		id: '1',
		title: 'One',
		tracks: [{ kind: 'chapters', file }],
	};
}

describe('chapter file compatibility', () => {
	it.each([oldFile, newFile])('reads each timing line as a separate cue', (file) => {
		expect(parseChapterFile(file)).toEqual(chapters);
	});

	it('reads a file whose cues carry no id line', () => {
		expect(parseChapterFile(noIds).map((cue) => [cue.start, cue.end, cue.title])).toEqual([
			[0, 47.5, 'Intro'],
			[47.5, 136, 'OP'],
		]);
	});

	it('drops a cue with no title or no length', () => {
		expect(parseChapterFile(`WEBVTT\n\n00:00:10 --> 00:00:10\nEmpty\n\n00:00:10 --> 00:00:20\n`)).toEqual([]);
	});
});

describe('the chapter file the media server names', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('is fetched from the signed-in server when its path is relative', async () => {
		const fetchMock = vi.fn(async () => new Response(newFile));

		vi.stubGlobal('fetch', fetchMock);

		await prepareChapterPlaylist([itemWithChapterTrack('/library/one/chapters.vtt')], 'placeholder-token', 'https://192-0-2-10.example.invalid:7626');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://192-0-2-10.example.invalid:7626/library/one/chapters.vtt',
			{ headers: { Authorization: 'Bearer placeholder-token' } },
		);
	});

	it('hands the parsed chapters to the player on the item', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response(oldFile)));

		const [prepared] = await prepareChapterPlaylist([itemWithChapterTrack('https://192-0-2-10.example.invalid/c.vtt')], null);

		expect(prepared?.chapters).toEqual(chapters);
	});

	it('leaves the item alone when the file fails to load', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
		const item = itemWithChapterTrack('https://192-0-2-10.example.invalid/c.vtt');

		expect(await prepareChapterPlaylist([item], null)).toEqual([item]);
	});
});
