import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSprite } from '../../../tooling/vite/moooomIcons';

const ROOT = process.env.ICON_SRC_DIR ?? path.resolve(__dirname, '../..');
const RESOURCES = path.resolve(__dirname, '../../../resources');
const source = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function spriteFile(file: string): ReturnType<typeof parseSprite> {
	const text = fs.readFileSync(path.join(RESOURCES, file), 'utf8');

	return parseSprite(text);
}

const sprite = Object.assign({}, ...['mooooom-icons.svg', 'player-icons.svg'].map(spriteFile));

// Icon names KMP uses at the same spot. The web sprite names the KMP FilmMedia "film".
const spots = {
	'layout/TopNavBar.vue': ['home1', 'folder', 'noteEighthPair', 'searchMagnifyingGlass'], // TvMainScaffold.kt:74-76, TvNavigationBar.kt:96
	'layout/TvMiniPlayer.vue': ['nmPlay'], // MiniPlayer.kt:195
	'players/music/ProgressControls.vue': ['nmShuffle', 'nmPrevious', 'nmPlay', 'nmPause', 'nmNext', 'nmRepeat', 'nmRepeatone', 'nmRepeatHalftone'], // ShuffleButton.kt:32, PreviousButton.kt:30, PlaybackButton.kt:31, NextButton.kt:30, RepeatButton.kt:39-41
	'server-components/NMHomeCard.vue': ['nmPlay', 'infoCircle'], // NMHomeCard.kt:328,350
	'server-components/NMTrackRow.vue': ['nmPlay', 'nmPause'], // NMTrackRow.kt:123
	'views/info/InfoScreen.vue': ['nmPlay', 'playCircle', 'bookmark', 'bookmarkAdd'], // NMDetailActions.kt:96,113,124
	'views/info/InfoSeasons.vue': ['chevronDown'], // SeasonCarousel.kt:186
	'views/info/SeasonPickerOverlay.vue': ['check'], // no KMP twin: the KMP dropdown shows no selected mark
	'views/music/MusicListScreen.vue': ['chevronLeft', 'heartFilled', 'heart', 'infoCircle', 'nmPlay', 'nmPause'], // ListScreen.kt:361-366, MediaLikeButton.kt:132, MediaAboutButton.kt:59, ThemedPlayButton.kt:54
	'views/now-playing/NowPlayingScreen.vue': ['cross', 'heartFilled', 'heart', 'lyrics'], // MediaLikeButton.kt:132, TvBarControls.kt:34; close has no KMP TV twin
	'components/feedback/EmptyState.vue': ['film'], // NMEmptyState.kt:87-90
} as const satisfies Record<string, readonly string[]>;

describe('receiver icons', () => {
	for (const [file, names] of Object.entries(spots)) {
		it(`${file} draws ${names.join(', ')} through MoooomIcon`, () => {
			const text = source(file);

			expect(text).toContain('<MoooomIcon');

			for (const name of names) {
				expect(text, name).toMatch(new RegExp(`['"]${name}['"]`));
				expect(sprite[name], name).toBeDefined();
			}
		});
	}
});
