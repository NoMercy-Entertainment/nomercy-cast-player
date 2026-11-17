import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { episodeDialog, languageDialog, preScreen, settingsPanel } from './panels';
import type { Choice, SettingsData, UiItem } from './panels';
import { playingAudioIndex, qualityValue, subtitleLabel, trackLabel, wireOrder } from './title';

// KMP shows the audio track that plays; the web player reports no selection until one is picked.
describe('playingAudioIndex', () => {
	it('x21 falls back to the default track, then the first, when nothing was picked', () => {
		expect(playingAudioIndex(null, [{ label: 'English' }, { label: 'Japanese', default: true }])).toBe(1);
		expect(playingAudioIndex(null, [{ label: 'English' }, { label: 'Japanese' }])).toBe(0);
		expect(playingAudioIndex(1, [{ label: 'English', default: true }, { label: 'Japanese' }])).toBe(1);
		expect(playingAudioIndex(null, [])).toBeNull();
	});
});

// KMP PlayerSettingsScreen.kt:288-289 shows the track label the player core composes: "English (Full)".
describe('trackLabel', () => {
	it('x18 names the language and the variant like KMP', () => {
		expect(trackLabel({ language: 'eng', label: 'full' }, 'en')).toBe('English (Full)');

		expect(trackLabel({
			language: 'eng',
			label: 'signs',
			type: 'signs',
		}, 'en')).toBe('English (Signs)');
	});

	it('x19 names an audio track by its language when the label is empty', () => {
		expect(trackLabel({ language: 'eng', label: '' }, 'en')).toBe('English');
		expect(trackLabel({ language: 'jpn', label: 'jpn' }, 'en')).toBe('Japanese');
	});

	it('x20 keeps the raw label when the language is unknown', () => {
		expect(trackLabel({ label: 'Commentary' }, 'en')).toBe('Commentary');
	});
});

// PlayerSettingsScreen.kt:287,294-297: with one real level, Auto resolves to it.
describe('qualityValue', () => {
	it('x29 names the only level, else the picked one, else Auto', () => {
		expect(qualityValue([pick('Auto', true), pick('1080p')], 'Auto')).toBe('1080p');
		expect(qualityValue([pick('Auto', true), pick('1080p'), pick('720p')], 'Auto')).toBe('Auto');
		expect(qualityValue([pick('Auto'), pick('1080p'), pick('720p', true)], 'Auto')).toBe('720p');
		expect(qualityValue([], 'Auto')).toBe('Auto');
	});
});

// LanguageNames.kt:50-85 (resolveSubtitleLabel, subtitleKindOf).
describe('subtitleLabel', () => {
	it('x26 names the variant by whole label words like KMP', () => {
		expect(subtitleLabel({ language: 'eng', label: 'sign' }, 'en')).toBe('English (Signs)');
		expect(subtitleLabel({ language: 'eng', label: 'eng.sdh' }, 'en')).toBe('English (SDH)');
		expect(subtitleLabel({ language: 'eng', label: 'full' }, 'en')).toBe('English (Full)');
		expect(subtitleLabel({ language: 'mlt', label: 'Maltese' }, 'en')).toBe('Maltese');
		expect(subtitleLabel({ language: 'eng', label: '' }, 'en')).toBe('English');
		expect(subtitleLabel({ language: 'und', label: '' }, 'en')).toBe('und');
	});
});

// AppPlaylistItem.kt:178-195: KMP lists subtitles in the server's order; the web core lists the manifest's first.
describe('wireOrder', () => {
	it('x27 puts the tracks in the order of the item, unknown ones last', () => {
		const shown = [
			{ language: 'eng', label: 'alt' },
			{ language: 'eng', label: 'full' },
			{ language: 'eng', label: 'sign' },
			{ language: 'dut', label: 'full' },
		];
		const wire = [
			{ language: 'eng', label: 'sign' },
			{ language: 'eng', label: 'alt' },
			{ language: 'eng', label: 'full' },
		];

		expect(wireOrder(shown, wire)).toEqual([2, 0, 1, 3]);
		expect(wireOrder(shown, [])).toEqual([0, 1, 2, 3]);
	});
});

// The vitest css option blanks imported stylesheets, so the source is read directly.
const css = `\n${readFileSync('src/players/video/plugins/tv-ui/style.css', 'utf8')}`;

function rule(selector: string): string {
	const start = css.indexOf(`\n${selector} {`);

	if (start < 0)
		return '';

	return css.slice(start, css.indexOf('}', start));
}

const noop = () => undefined;

function pick(label: string, selected = false) {
	return ({
		label,
		selected,
		onPick: noop,
	}) as const satisfies Choice;
}

const item = {
	id: 1,
	title: 'Weak Square',
	show: 'No Game No Life',
	season: 1,
	episode: 5,
	description: 'Sora and Shiro leave the running of the country to Steph.',
	logo: 'https://image.example/logo.png',
	image: 'https://image.example/still.jpg',
	duration: 1440,
} as const satisfies UiItem;

const options = {
	playlistSize: 3,
	episodeCount: 3,
	onPlay: noop,
	onRestart: noop,
	onLanguage: noop,
	onEpisodes: noop,
};

// PreScreenDialog.kt:131-170 and LinkButton.kt:112-190.
describe('pre-screen matches PreScreenDialog.kt', () => {
	it('x01 a show logo image replaces the text title', () => {
		const { root } = preScreen({ ...options, item });

		expect(root.querySelector('img.tvui-pre-logo')?.getAttribute('src')).toBe(item.logo);
		expect(root.querySelector('.tvui-pre-title')).toBeNull();
	});

	// PreScreenDialog.kt:133-148: the logo fills the 72 dp block, Fit and centered (TMDBImage.kt:51).
	it('x30 the logo fits a 72 px box, centered like Compose', () => {
		const block = rule('.tvui-pre-logo');

		expect(block).toContain('height: 72px');
		expect(block).toContain('object-position: left center');
	});

	// Material 3 letter spacing: plain Text is bodyLarge 0.5; PreScreenDialog.kt:153-283 picks headline, bodySmall, bodyMedium.
	it('x31 letter spacing follows the Material 3 style of each text', () => {
		expect(rule('.tvui-root')).toContain('letter-spacing: 0.5px');
		expect(rule('.tvui-pre-title')).toContain('letter-spacing: 0');
		expect(rule('.tvui-meta')).toContain('letter-spacing: 0');
		expect(rule('.tvui-pre-episode-title')).toContain('letter-spacing: 0');
		expect(rule('.tvui-pre-episode-label')).toContain('letter-spacing: 0.4px');
		expect(rule('.tvui-pre-overview')).toContain('letter-spacing: 0.25px');
	});

	it('x02 without a logo the text title shows', () => {
		const { root } = preScreen({ ...options, item: { ...item, logo: undefined } });

		expect(root.querySelector('.tvui-pre-title')?.textContent).toBe('No Game No Life');
	});

	it('x03 no year is drawn (the wire item never carries one)', () => {
		const { root } = preScreen({ ...options, item: { ...item, year: 2014 } });

		expect(root.querySelector('.tvui-meta')?.textContent).toBe('3 Episodes');
	});

	it('x04 the episode line is a label span and a title span', () => {
		const { root } = preScreen({ ...options, item });

		expect(root.querySelector('.tvui-pre-episode-label')?.textContent).toBe('S1E5');
		expect(root.querySelector('.tvui-pre-episode-title')?.textContent).toBe('Weak Square');
	});

	it('x05 the buttons use the KMP icons', () => {
		const { root } = preScreen({ ...options, item });
		const names = Array.from(root.querySelectorAll('.tvui-pre-buttons [data-icon]')).map((n) => n.getAttribute('data-icon'));

		// PreScreenDialog.kt:306: Play is the solid nmplaysolid, the sprite's nmPlay.
		expect(names).toEqual(['nmPlay', 'playCircle', 'globe', 'playlist1']);
	});

	it('x06 the buttons are 250 x 44, 12 radius, 1 px border, 4 gap', () => {
		expect(rule('.tvui-pre-buttons')).toContain('width: 250px');
		expect(rule('.tvui-pre-buttons')).toContain('gap: 4px');
		expect(rule('.tvui-pre-buttons .tvui-button')).toContain('height: 44px');
		expect(rule('.tvui-pre-buttons .tvui-button')).toContain('border-radius: 12px');
		expect(rule('.tvui-pre-buttons .tvui-button')).toContain('border: 1px solid rgb(255 255 255 / 0.18)');
	});

	it('x07 the overview is 16 px medium on a 20 px line, 4 lines at most', () => {
		const block = rule('.tvui-pre-overview');

		expect(block).toContain('font-size: 16px');
		expect(block).toContain('font-weight: 500');
		expect(block).toContain('line-height: 20px');
		expect(block).toContain('-webkit-line-clamp: 4');
	});
});

// The playlist sends raw TMDB paths; on the living-room TV the logo and every still failed to load.
describe('images resolve like the rest of the receiver', () => {
	const raw = {
		...item,
		logo: '/ngnl-logo.png',
		image: '/ngnl-still.jpg',
	} as const satisfies UiItem;

	it('x22 the pre-screen logo loads from TMDB', () => {
		const { root } = preScreen({ ...options, item: raw });

		expect(root.querySelector('img.tvui-pre-logo')?.getAttribute('src'))
			.toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/\w+\/ngnl-logo\.png$/);
	});

	it('x23 the episode still loads from TMDB', () => {
		const { root } = episodeDialog({
			items: [raw],
			currentIndex: 0,
			onPick: noop,
		});
		const art = root.querySelector<HTMLElement>('.tvui-card-art');

		expect(art?.style.backgroundImage).toContain('https://image.tmdb.org/t/p/');
	});

	it('x24 a logo that fails to load gives way to the text title', () => {
		const { root } = preScreen({ ...options, item: raw });

		root.querySelector('img.tvui-pre-logo')?.dispatchEvent(new Event('error'));

		expect(root.querySelector('img.tvui-pre-logo')).toBeNull();
		expect(root.querySelector('.tvui-pre-title')?.textContent).toBe('No Game No Life');
	});
});

// EpisodeCard.kt:123-165 and :200-231.
describe('episodes match EpisodeDialog.kt', () => {
	it('x08 the still carries the S#E# label and the duration', () => {
		const { root } = episodeDialog({
			items: [item],
			currentIndex: 0,
			onPick: noop,
		});

		expect(root.querySelector('.tvui-card-art .tvui-card-label')?.textContent).toBe('S1E5');
		expect(root.querySelector('.tvui-card-art .tvui-card-duration')?.textContent).toBe('24 min');
	});

	it('x09 the title is bold 16/18 and the overview 13/16 at 70 percent', () => {
		expect(rule('.tvui-card-title')).toContain('font-weight: 700');
		expect(rule('.tvui-card-title')).toContain('line-height: 18px');
		expect(rule('.tvui-card-overview')).toContain('font-size: 13px');
		expect(rule('.tvui-card-overview')).toContain('line-height: 16px');
		expect(rule('.tvui-card-overview')).toContain('-webkit-line-clamp: 4');
	});

	// EpisodeCard.kt:167-195.
	it('x28 progress is a 30 percent track with a white fill, only past 1 percent', () => {
		const card = (time: number) => episodeDialog({
			items: [{ ...item, progress: { time } }],
			currentIndex: 0,
			onPick: noop,
		}).root;

		expect(card(10).querySelector('.tvui-card-progress')).toBeNull();
		expect(card(720).querySelector<HTMLElement>('.tvui-card-progress .tvui-card-progress-fill')?.style.width).toBe('50%');
		expect(rule('.tvui-card-progress')).toContain('background: rgb(255 255 255 / 0.3)');
		expect(rule('.tvui-card-progress-fill')).toContain('background: var(--cast-white)');
	});

	it('x10 seasons sit centered in a column, episodes take twice the width', () => {
		expect(rule('.tvui-seasons')).toContain('justify-content: center');
		expect(rule('.tvui-seasons')).toContain('gap: 8px');
		expect(rule('.tvui-episode-list')).toContain('flex: 2');
		expect(rule('.tvui-episodes')).toContain('background: rgb(0 0 0 / 0.9)');
	});
});

// LanguageDialog.kt:71-184 and TvSelectableMenuItem.kt:49-95.
describe('languages match LanguageDialog.kt', () => {
	it('x11 the dialog pads 40 x 32 with 24 between columns', () => {
		const block = rule('.tvui-languages');

		expect(block).toContain('padding: 32px 40px');
		expect(block).toContain('gap: 24px');
	});

	it('x12 the selected row shows a check, the others none', () => {
		const { root } = languageDialog({
			quality: [pick('Auto', true)],
			audio: [pick('English', true), pick('Japanese')],
			subtitles: [pick('Off'), pick('English (Full)', true)],
			autoSkip: true,
			onToggleAutoSkip: noop,
			onSearch: noop,
		});

		expect(root.querySelectorAll('.tvui-selected [data-icon="check"]').length).toBe(3);
		expect(root.querySelectorAll('.tvui-column').length).toBe(3);
		expect(rule('.tvui-column')).toContain('gap: 8px');
		expect(rule('.tvui-column-title')).toContain('font-size: 16px');
	});

	it('x13 a row is 15 px text, 44 px high, 12 radius', () => {
		expect(rule('.tvui-row')).toContain('font-size: 15px');
		expect(rule('.tvui-row')).toContain('min-height: 44px');
		expect(rule('.tvui-row')).toContain('border-radius: 12px');
	});
});

// PlayerSettingsScreen.kt:159-247 and :457-523.
describe('settings match PlayerSettingsScreen.kt', () => {
	const data = {
		nav: { pane: 'main', styleProp: null },
		levels: [pick('Auto', true), pick('1080p'), pick('720p')],
		subtitles: [pick('Off', true)],
		audio: [pick('English', true), pick('Dutch')],
		values: {
			quality: '1080p',
			subtitle: 'Off',
			audio: 'English',
		},
		autoSkip: true,
		style: {
			font: 'Default',
			size: 24,
			edge: 'none',
			color: 'white',
			background: 0,
		},
		styleChoices: () => [],
		open: noop,
		onBack: noop,
		onRestart: noop,
		onToggleAutoSkip: noop,
		onResetStyle: noop,
	} as const satisfies SettingsData;

	it('x14 the header pads 12 x 8 and the rows list is padded 8 and centered', () => {
		expect(rule('.tvui-sidebar-header')).toContain('padding: 8px 12px');
		expect(rule('.tvui-sidebar-body')).toContain('justify-content: center');
		expect(rule('.tvui-sidebar-rows')).toContain('padding: 8px');
	});

	it('x15 two-line rows are 14 on 26 and 12 on 22', () => {
		expect(rule('.tvui-sidebar .tvui-row')).toContain('line-height: 26px');
		expect(rule('.tvui-sidebar .tvui-row-value')).toContain('line-height: 22px');
	});

	it('x16 the rows sit in a body that centers them', () => {
		const { root } = settingsPanel(data);

		expect(root.querySelector('.tvui-sidebar-body .tvui-sidebar-rows')).not.toBeNull();
	});
});
