// @vitest-environment jsdom
import { checkRows } from './i18nRows';
import type { I18nRow } from './i18nRows';

const rows: I18nRow[] = [
	['players/music/Lyrics.vue', 'Lyrics coming soon.', 'music.player.lyrics_coming_soon', 'Lyrics coming soon.'],
	['players/music/QueuePeek.vue', '<h3>Up next</h3>', 'music.player.up_next', 'Up next'],
	['players/music/ProgressControls.vue', 'aria-label="Shuffle"', 'music.player.shuffle', 'Shuffle', 'Shuffle'],
	['players/music/ProgressControls.vue', 'aria-label="Previous track"', 'music.player.previous_track', 'Previous track'],
	['players/music/ProgressControls.vue', 'playing ? \'Pause\'', 'common.pause', 'Pause', 'Pauzeren'],
	['players/music/ProgressControls.vue', 'aria-label="Next track"', 'music.player.next_track', 'Next track'],
	['players/music/ProgressControls.vue', '`Repeat ', 'music.player.repeat_off', 'Repeat off'],
	['players/music/transport.ts', 'return \'Live\'', 'music.player.live', 'Live', 'Live'],
	['players/video/VideoPlayer.vue', 'The video player could not start.', 'player.start_error', 'The video player could not start.'],
];

checkRows('players', rows);
