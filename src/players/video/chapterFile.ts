import type { PlaylistItem } from '@/queries/usePlaylistQuery';

export interface ChapterCue { start: number; end: number; title: string }

const TIMING = /^(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+-->\s+(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)/;

function seconds(value: string): number {
	const [hours, minutes, rest] = value.split(':');
	return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest);
}

export function parseChapterFile(file: string): ChapterCue[] {
	const lines = file.replace(/\r/g, '').split('\n');
	const cues: ChapterCue[] = [];
	for (let i = 0; i < lines.length; i++) {
		const match = TIMING.exec(lines[i].trim());
		if (!match)
			continue;
		const title = lines[i + 1]?.trim();
		if (title && seconds(match[2]) > seconds(match[1]))
			cues.push({ start: seconds(match[1]), end: seconds(match[2]), title });
	}
	return cues;
}

function timestamp(value: number): string {
	const ms = Math.round(value * 1000);
	return `${String(Math.floor(ms / 3_600_000)).padStart(2, '0')}:${String(Math.floor(ms / 60_000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}

export function serializeChapters(cues: ChapterCue[]): string {
	return `WEBVTT\n\n${cues.map((cue, index) => `Chapter ${index + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.title}`).join('\n\n')}\n`;
}

export async function prepareChapterPlaylist(items: PlaylistItem[], token: string | null, baseUrl?: string | null): Promise<{ playlist: PlaylistItem[]; dispose: () => void }> {
	const urls: string[] = [];
	const playlist = await Promise.all(items.map(async (item) => {
		const tracks = Array.isArray(item.tracks) ? item.tracks as Array<{ kind?: string; file?: string }> : [];
		const chapter = tracks.find(track => track.kind === 'chapters' && typeof track.file === 'string');
		if (!chapter?.file)
			return item;
		try {
			// The server names its files relative to itself, not to this receiver's origin.
			const source = baseUrl ? new URL(chapter.file, baseUrl).href : chapter.file;
			const response = await fetch(source, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
			if (!response.ok)
				return item;
			const cues = parseChapterFile(await response.text());
			if (!cues.length)
				return item;
			const url = URL.createObjectURL(new Blob([serializeChapters(cues)], { type: 'text/vtt' }));
			urls.push(url);
			return { ...item, tracks: tracks.map(track => track === chapter ? { ...track, file: url } : track) };
		}
		catch {
			return item;
		}
	}));
	return { playlist, dispose: () => urls.forEach(url => URL.revokeObjectURL(url)) };
}
