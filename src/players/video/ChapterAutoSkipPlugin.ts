/**
 * ChapterAutoSkipPlugin per spec §12.4. Mirrors android equivalent —
 * automatically skips intro / credits chapters when the user setting is
 * on, otherwise emits 'chapter-skip-available' so the WatchScreen can
 * surface a "Skip Intro" button.
 *
 * Receiver-side stub: instead of binding to the npm package's Plugin
 * base class (which expects construction via player.use()), we expose
 * an attach/detach pair that wires player events explicitly. This
 * works regardless of whether the npm package version on the receiver
 * actually exports a Plugin abstract class that matches our
 * expectations.
 */

import type { NMVideoPlayer } from '@nomercy-entertainment/nomercy-video-player';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';
import { segmentsForItem } from './skipSegments';

// The events this plugin exchanges with the overlay are not in the player's typed map.
type PlayerLike = Pick<NMVideoPlayer, 'time' | 'item' | 'chapters'> & {
	on: (event: string, handler: (data: unknown) => void) => void;
	off: (event: string, handler?: (data: unknown) => void) => void;
	emit?: (event: string, data?: unknown) => void;
};

interface SkipChapter { id: string; type?: string; endTime?: number; startTime?: number }

// Server chapter files name the intro and credits by title.
function chapterType(title: string): string | undefined {
	const lower = title.toLowerCase();
	if (lower.includes('intro') || lower.includes('opening'))
		return 'intro';
	if (lower.includes('credit') || lower.includes('ending') || lower.includes('outro'))
		return 'credits';
	return undefined;
}

function chapterAt(player: PlayerLike, t: number): SkipChapter | null {
	const found = player.chapters().find(chapter => t >= chapter.start && t < chapter.end);
	if (!found)
		return null;
	return { id: `chapter-${found.index}`, type: chapterType(found.title), startTime: found.start, endTime: found.end };
}

let lastChapterId: string | null = null;
const unsubs: Array<() => void> = [];

let userPrefAutoSkip = false;
export function setAutoSkipEnabled(enabled: boolean): void {
	userPrefAutoSkip = enabled;
}

export function attachChapterAutoSkip(player: PlayerLike): void {
	const onTime = (): void => {
		const t = player.time();
		const item = player.item();
		const segments = segmentsForItem(item);
		const intro = segments.find(segment => segment.type.toLowerCase() === 'intro'
			&& typeof segment.start === 'number' && typeof segment.end === 'number'
			&& t >= segment.start && t < segment.end);
		const chapter = segments.length
			? intro ? { id: `intro-${intro.start}`, type: 'intro', startTime: intro.start, endTime: intro.end } : null
			: chapterAt(player, t);
		if (!chapter) {
			if (lastChapterId !== null)
				player.emit?.('chapter-skip-clear');
			lastChapterId = null;
			return;
		}
		if (chapter.id === lastChapterId)
			return;

		if (chapter.type === 'credits' || chapter.type === 'intro') {
			if (userPrefAutoSkip && typeof chapter.endTime === 'number') {
				void player.time(chapter.endTime);
			}
			else {
				player.emit?.('chapter-skip-available', chapter);
			}
		}
		else {
			player.emit?.('chapter-skip-clear');
		}

		lastChapterId = chapter.id;
	};

	player.on('time', onTime);
	unsubs.push(() => player.off('time', onTime));
	const onSeek = (): void => {
		player.emit?.('chapter-skip-clear');
		lastChapterId = null;
	};
	player.on('seek', onSeek);
	unsubs.push(() => player.off('seek', onSeek));
}

export function detachChapterAutoSkip(): void {
	while (unsubs.length > 0) {
		try {
			unsubs.pop()?.();
		}
		catch (error) {
			// best-effort
			recordSwallowed('detachChapterAutoSkip', error);
		}
	}
	lastChapterId = null;
}
