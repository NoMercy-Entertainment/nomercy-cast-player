import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const nm = decls('styles/nm-tokens.css', ':root');
const own = decls('styles/tokens.css', ':root');

/** The computed value of a color declaration: var() chains followed through the token files. */
function resolve(value: string | undefined): string | undefined {
	let v = value;
	for (let i = 0; v && i < 8; i++) {
		const m = v.match(/^var\((--[\w-]+)\)$/);
		if (!m)
			break;
		v = own[m[1]] ?? nm[m[1]];
	}
	return v;
}

// The receiver's light ink is KMP's onSurface, slate_1 #fbfcfd (NoMercyTheme.kt:576, :544, :473), not NM's #EDEDED.
// These 49 declarations were #fff before the NM token pass and map to --cast-text-primary.
const WHITE_TEXT: [string, string][] = [
	['components/text/SplitTitleText.vue', '.split-main'],
	['layout/NavLink.vue', '.nav-link'],
	['layout/NavLink.vue', '.icon'],
	['layout/ProfileChip.vue', '.initials'],
	['layout/TvMiniPlayer.vue', '.mini-player'],
	['layout/TvMiniPlayer.vue', '.art'],
	['server-components/NMCard.vue', '.caption'],
	['server-components/NMCarousel.vue', '.show-all'],
	['server-components/NMGrid.vue', '.more-link:focus-visible'],
	['server-components/NMHomeCard.vue', '.content'],
	['server-components/NMMusicCard.vue', '.letter'],
	['styles/components.css', '.nm-hero-title-main'],
	['styles/components.css', '.nm-hero-overview'],
	['styles/components.css', '.nm-pill-primary'],
	['styles/components.css', '.nm-pill-secondary'],
	['styles/components.css', '.nm-pill-sm-primary'],
	['styles/components.css', '.nm-pill-sm-secondary'],
	['styles/components.css', '.nm-list-row'],
	['styles/components.css', '.nm-dialog'],
	['styles/tv-safe.css', '.panel'],
	['styles/tv-safe.css', '.panel-button-secondary'],
	['styles/tv-safe.css', '.season-row.current'],
	['styles/tv-safe.css', '.season-row:focus-visible'],
	['styles/tv-safe.css', '.episode-card'],
	['styles/tv-safe.css', '.episode-thumb-meta'],
	['styles/tv-safe.css', '.lang-section h3'],
	['styles/tv-safe.css', '.lang-section .track-row.current'],
	['styles/tv-safe.css', '.lang-section .track-row:focus-visible'],
	['styles/tv-safe.css', '.skip-chapter-prompt'],
	['styles/tv-safe.css', '.osd-top-title'],
	['styles/tv-safe.css', '.osd-center-message'],
	['styles/tv-safe.css', '.osd-title'],
	['styles/tv-safe.css', '.osd-progress-row'],
	['styles/tv-safe.css', '.seek-time'],
	['views/home/HomeHero.vue', '.content'],
	['views/info/InfoScreen.vue', '.info-screen'],
	['views/info/InfoSeasons.vue', '.season-chip'],
	['views/info/SeasonPickerOverlay.vue', '.season-row'],
	['views/music/MusicAboutDialog.vue', '.about-dialog'],
	['views/music/MusicGenresScreen.vue', '.placeholder'],
	['views/music/MusicListScreen.vue', '.music-list-screen'],
	['views/music/MusicListScreen.vue', '.icon-btn'],
	['views/music/MusicListScreen.vue', '.header-col :deep(.nm-pill-primary)'],
	['views/person/PersonScreen.vue', '.placeholder'],
	['views/profile/AboutScreen.vue', '.about-card'],
	['views/profile/ProfileScreen.vue', '.avatar-fallback'],
	['views/profile/ServerInfoScreen.vue', '.card'],
	['views/profile/SettingsCategories.vue', '.category-item.selected'],
	['views/profile/SettingsCategories.vue', '.category-item:focus-visible'],
];

describe('receiver light text is KMP onSurface (NoMercyTheme.kt:576)', () => {
	it('names the role token once, after KMP slate_1', () => {
		expect(own['--cast-text-primary']).toBe('var(--cast-white)');
	});

	it('lists 49 spots', () => {
		expect(WHITE_TEXT).toHaveLength(49);
	});

	it.each(WHITE_TEXT)('%s %s computes to white', (file, selector) => {
		expect(resolve(decls(file, selector).color)).toBe('#fff');
	});
});
