import { parseVtt } from '@nomercy-entertainment/nomercy-player-core';
import type { Chapter } from '@nomercy-entertainment/nomercy-player-core';
import type { PlaylistItem } from '@/queries/usePlaylistQuery';

const TIMING = /-->/;

// Old server files run the cues together with no blank line, and the VTT parser
// reads that as one cue. Insert the blank line a cue boundary needs.
function separateCues(file: string): string {
	const lines = file.replaceAll('\r', '').split('\n');
	const breakBefore = new Set<number>();

	lines.forEach((line, index) => {
		if (!TIMING.test(line) || index === 0) return;

		const previous = (lines[index - 1] ?? '').trim();
		const before = (lines[index - 2] ?? '').trim();

		if (!previous) return;

		if (previous.startsWith('WEBVTT') || TIMING.test(before)) {
			breakBefore.add(index);
		} else if (before) {
			breakBefore.add(index - 1);
		}
	});

	return lines.flatMap((line, index) =>
		breakBefore.has(index)
			? ['', line]
			: [line]).join('\n');
}

export function parseChapterFile(file: string): Chapter[] {
	return parseVtt(separateCues(file)).cues.map((cue) => ({
		start: cue.start,
		end: cue.end,
		title: (cue.payload.split('\n')[0] ?? '').trim(),
	})).filter((cue) => cue.title && cue.end > cue.start).map((cue, index) => ({ index, ...cue }));
}

export async function prepareChapterPlaylist(
	items: PlaylistItem[],
	token: string | null,
	baseUrl?: string | null,
): Promise<PlaylistItem[]> {
	return Promise.all(items.map(async (item) => {
		const tracks = Array.isArray(item.tracks)
			? item.tracks as Array<{ kind?: string; file?: string }>
			: [];
		const chapter = tracks.find((track) => track.kind === 'chapters' && typeof track.file === 'string');

		if (!chapter?.file)
			return item;

		try {
			// The server names its files relative to itself, not to this receiver's origin.
			const source = baseUrl
				? new URL(chapter.file, baseUrl).href
				: chapter.file;
			const response = await fetch(source, { headers: token
				? { Authorization: `Bearer ${token}` }
				: {} });

			if (!response.ok)
				return item;

			const chapters = parseChapterFile(await response.text());

			return chapters.length
				? { ...item, chapters }
				: item;
		} catch {
			return item;
		}
	}));
}
