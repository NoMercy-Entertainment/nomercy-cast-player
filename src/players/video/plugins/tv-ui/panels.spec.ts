import { describe, expect, it } from 'vitest';
import { centerMessage, loadingLayer } from './overlays';
import { bottomBar, episodeDialog, errorDialog, languageDialog, messageDialog, preScreen, settingsPanel, subtitleDialog, topBar } from './panels';
import type { Choice, SettingsData, UiItem } from './panels';

function choice(label: string, selected = false) {
	return {
		label,
		selected,
		onPick: () => undefined,
	} as const satisfies Choice;
}

function settingsData(overrides: Partial<SettingsData> = {}): SettingsData {
	return {
		nav: { pane: 'main', styleProp: null },
		levels: [choice('Auto', true), choice('1080p'), choice('720p')],
		subtitles: [choice('Off', true), choice('Dutch')],
		audio: [choice('English', true), choice('Dutch')],
		values: {
			quality: 'Auto',
			subtitle: 'Off',
			audio: 'English',
		},
		autoSkip: false,
		style: {
			font: 'Default',
			size: 24,
			edge: 'none',
			color: 'white',
			background: 0,
		},
		styleChoices: () => [choice('One', true), choice('Two')],
		open: () => undefined,
		onBack: () => undefined,
		onRestart: () => undefined,
		onToggleAutoSkip: () => undefined,
		onResetStyle: () => undefined,
		...overrides,
	};
}

function rowLabels(root: HTMLElement): string[] {
	return Array.from(root.querySelectorAll('.tvui-sidebar-rows .tvui-row-label')).map((node) => node.textContent ?? '');
}

describe('bottom bar (TVBottomBar.kt, ChapterProgressBar.kt)', () => {
	const state = {
		playing: true,
		time: 30,
		duration: 100,
		buffered: 60,
		chapters: [{ start: 0, end: 50 }, { start: 50, end: 100 }],
	};

	it('b05a the elapsed readout shows the scrubbed time while the strip is open', () => {
		const bar = bottomBar(() => undefined);

		bar.update({ ...state, override: 75 });
		expect(bar.root.querySelector('.tvui-time')?.textContent).toBe('01:15');
	});

	it('b05b without an override the elapsed readout shows the playhead and the rest shows what is left', () => {
		const bar = bottomBar(() => undefined);

		bar.update(state);
		const times = Array.from(bar.root.querySelectorAll('.tvui-time')).map((node) => node.textContent);

		expect(times).toEqual(['00:30', '01:10']);
	});

	it('b05c the play button shows pause while playing and play while paused', () => {
		const bar = bottomBar(() => undefined);

		bar.update(state);
		expect(bar.root.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('pause');
		bar.update({ ...state, playing: false });
		expect(bar.root.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('play');
	});

	it('c20a the chapter bar has one segment per chapter, grown by its length', () => {
		const bar = bottomBar(() => undefined);

		bar.update({ ...state, chapters: [{ start: 0, end: 25 }, { start: 25, end: 100 }] });
		const grows = Array.from(bar.root.querySelectorAll<HTMLElement>('.tvui-chapter')).map((node) => node.style.flexGrow);

		expect(grows).toEqual(['0.25', '0.75']);
	});

	it('c20b a segment is filled up to the playhead and the buffered share is set on every segment', () => {
		const bar = bottomBar(() => undefined);

		bar.update(state);
		const fills = Array.from(bar.root.querySelectorAll<HTMLElement>('.tvui-chapter-fill')).map((node) => node.style.width);
		const buffered = Array.from(bar.root.querySelectorAll<HTMLElement>('.tvui-chapter')).map((node) => node.style.getPropertyValue('--buffered'));

		expect(fills).toEqual(['60%', '0%']);
		expect(buffered).toEqual(['60%', '60%']);
	});

	it('c20c without chapters one segment spans the whole duration', () => {
		const bar = bottomBar(() => undefined);

		bar.update({ ...state, chapters: [] });
		expect(bar.root.querySelectorAll('.tvui-chapter')).toHaveLength(1);
	});
});

describe('shared overlays (CenterMessage.kt, CastLoadingOverlay.kt)', () => {
	it('c19 the center message carries the text as a status', () => {
		const node = centerMessage('Subtitles off');

		expect(node.textContent).toBe('Subtitles off');
		expect(node.getAttribute('role')).toBe('status');
	});

	it('l01 the loading layer draws the item image, a spinner and two lines', () => {
		const node = loadingLayer('/one.jpg');

		expect(node.querySelector<HTMLElement>('.tvui-loading-art')?.style.backgroundImage).toContain('/one.jpg');
		expect(node.querySelector('.tvui-spinner')).not.toBeNull();
		expect(node.querySelector('.tvui-loading-title')?.textContent).toBe('Loading…');
		expect(node.querySelector('.tvui-loading-subtitle')?.textContent).toBe('Preparing playback');
	});
});

describe('settings panes (PlayerSettingsScreen.kt:128-173)', () => {
	it('p01a the main pane lists audio, subtitles, style, quality, auto-skip and restart in that order', () => {
		const { root } = settingsPanel(settingsData());

		expect(rowLabels(root)).toEqual(['Audio Tracks', 'Subtitle Tracks', 'Subtitle style', 'Quality', 'Auto-skip', 'Restart from beginning']);
	});

	it('p01b the main pane shows the current value of the rows that have one', () => {
		const { root } = settingsPanel(settingsData());
		const values = Array.from(root.querySelectorAll('.tvui-sidebar-rows .tvui-row-value')).map((node) => node.textContent);

		expect(values).toEqual(['English', 'Off', 'Auto', 'Off']);
	});

	it('p03c the quality row is disabled without a real choice and the audio row with one track', () => {
		const { root } = settingsPanel(settingsData({
			levels: [choice('Auto', true), choice('1080p')],
			audio: [choice('English', true)],
		}));

		const disabled = Array.from(root.querySelectorAll('.tvui-row[aria-disabled] .tvui-row-label')).map((node) => node.textContent);

		expect(disabled).toEqual(['Audio Tracks', 'Quality']);
	});

	it('p04b the first enabled row takes the initial focus', () => {
		const { root, focus } = settingsPanel(settingsData({ audio: [choice('English', true)] }));

		document.body.append(root);
		focus();
		expect(document.activeElement?.textContent).toContain('Subtitle Tracks');
		root.remove();
	});

	it('p09 each choice pane lists its choices with a check on the selected one', () => {
		for (const pane of ['quality', 'subtitle', 'audio'] as const) {
			const { root } = settingsPanel(settingsData({ nav: { pane, styleProp: null } }));
			const selected = root.querySelectorAll('.tvui-row.tvui-selected');

			expect(rowLabels(root).length).toBeGreaterThan(1);
			expect(selected).toHaveLength(1);
			expect(selected[0]?.querySelector('[data-icon="check"]')).not.toBeNull();
		}
	});

	it('p10 the style pane lists font, size, edge, color, background and reset', () => {
		const { root } = settingsPanel(settingsData({ nav: { pane: 'subtitleStyle', styleProp: null } }));

		expect(rowLabels(root)).toEqual(['Font', 'Text size', 'Edge style', 'Text color', 'Background', 'Reset to default']);
	});

	it('p11 a style property pane lists its choices and its header names the property', () => {
		const { root } = settingsPanel(settingsData({ nav: { pane: 'subtitleStyle', styleProp: 'edgeStyle' } }));

		expect(root.querySelector('.tvui-sidebar-header > span')?.textContent).toBe('Edge style');
		expect(rowLabels(root)).toEqual(['One', 'Two']);
	});

	it('p12 the header back button steps back', () => {
		let backs = 0;
		const { root } = settingsPanel(settingsData({ onBack: () => {
			backs++;
		} }));

		root.querySelector<HTMLElement>('.tvui-sidebar-header button')!.click();
		expect(backs).toBe(1);
	});
});

function attached(root: HTMLElement): () => void {
	document.body.append(root);

	return () => root.remove();
}

const episode = (overrides: Partial<UiItem> = {}) => ({
	show: 'Show',
	title: 'Pilot',
	season: 1,
	episode: 2,
	...overrides,
}) as const satisfies UiItem;

describe('top bar (TVTopBar.kt)', () => {
	const noop = () => undefined;

	it('t01 the title sits over the season and episode line', () => {
		const { root } = topBar({
			item: episode(),
			hasNext: false,
			onSettings: noop,
			onNext: noop,
		});

		expect(root.querySelector('.tvui-title')?.textContent).toBe('Show');
		expect(root.querySelector('.tvui-subtitle')?.textContent).toBe('S1E2 • Pilot');
	});

	it('t02 the next button is drawn only when the item has a next one', () => {
		const count = (hasNext: boolean): number => topBar({
			item: episode(),
			hasNext,
			onSettings: noop,
			onNext: noop,
		}).root.querySelectorAll('.tvui-icon-button').length;

		expect(count(false)).toBe(1);
		expect(count(true)).toBe(2);
	});

	it('t03 the buttons call their handlers and the settings button takes the initial focus', () => {
		const calls: string[] = [];
		const bar = topBar({
			item: episode(),
			hasNext: true,
			onSettings: () => calls.push('settings'),
			onNext: () => calls.push('next'),
		});
		const detach = attached(bar.root);

		bar.focus();
		expect(document.activeElement?.getAttribute('aria-label')).toBe('Settings');
		bar.root.querySelectorAll<HTMLElement>('.tvui-icon-button').forEach((button) => button.click());
		expect(calls).toEqual(['settings', 'next']);
		detach();
	});
});

describe('menu item (TvSelectableMenuItem.kt)', () => {
	it('m01 a row shows its label, a check when selected, and is a focusable button', () => {
		const { root } = languageDialog({
			quality: [],
			audio: [],
			subtitles: [choice('Off', true), choice('Dutch')],
			autoSkip: false,
			onToggleAutoSkip: () => undefined,
			onSearch: () => undefined,
		});

		const rows = Array.from(root.querySelectorAll<HTMLElement>('.tvui-row'));
		const off = rows.find((node) => node.textContent?.includes('Off'))!;
		const dutch = rows.find((node) => node.textContent?.includes('Dutch'))!;

		expect(off.classList.contains('tvui-selected')).toBe(true);
		expect(off.querySelector('[data-icon="check"]')).not.toBeNull();
		expect(dutch.classList.contains('tvui-selected')).toBe(false);
		expect(dutch.querySelector('[data-icon="check"]')).toBeNull();
		expect(dutch.getAttribute('role')).toBe('button');
		expect(dutch.tabIndex).toBe(0);
	});

	it('m02 picking a row calls its handler', () => {
		const picked: string[] = [];
		const { root } = languageDialog({
			quality: [],
			audio: [],
			subtitles: [{
				label: 'Dutch',
				selected: false,
				onPick: () => picked.push('Dutch'),
			}],
			autoSkip: false,
			onToggleAutoSkip: () => undefined,
			onSearch: () => undefined,
		});

		root.querySelectorAll<HTMLElement>('.tvui-row').forEach((node) => {
			if (node.textContent?.includes('Dutch'))
				node.click();
		});

		expect(picked).toEqual(['Dutch']);
	});
});

describe('episode dialog (EpisodeDialog.kt)', () => {
	const items = [
		episode({
			id: 1,
			season: 0,
			episode: 1,
			title: 'Special',
		}),
		episode({
			id: 2,
			season: 1,
			episode: 1,
			title: 'Pilot',
			duration: 100,
			progress: { time: 50 },
		}),
		episode({
			id: 3,
			season: 2,
			episode: 1,
			title: 'Return',
		}),
	];

	it('e01 one season row per season, the current season selected, season 0 named Extras', () => {
		const { root } = episodeDialog({
			items,
			currentIndex: 1,
			onPick: () => undefined,
		});

		const seasons = Array.from(root.querySelectorAll('.tvui-seasons .tvui-row'));

		expect(seasons.map((node) => node.textContent)).toEqual(['Extras', 'Season 1', 'Season 2']);
		expect(seasons.map((node) => node.classList.contains('tvui-selected'))).toEqual([false, true, false]);
	});

	it('e02 one card per episode with the label and title, the current one selected, progress drawn', () => {
		const { root } = episodeDialog({
			items,
			currentIndex: 1,
			onPick: () => undefined,
		});

		const cards = Array.from(root.querySelectorAll<HTMLElement>('.tvui-card'));

		expect(cards).toHaveLength(3);
		expect(cards[1]?.querySelector('.tvui-card-title')?.textContent).toBe('S1E1 • Pilot');
		expect(cards[0]?.querySelector('.tvui-card-title')?.textContent).toBe('Extras E1 • Special');
		expect(cards.map((node) => node.classList.contains('tvui-selected'))).toEqual([false, true, false]);
		expect(cards[1]?.querySelector<HTMLElement>('.tvui-card-progress')?.style.width).toBe('50%');
		expect(cards[2]?.querySelector('.tvui-card-progress')).toBeNull();
	});

	it('e03 picking a card passes its index and the dialog focuses the current card', () => {
		const picked: number[] = [];
		const dialog = episodeDialog({
			items,
			currentIndex: 1,
			onPick: (index) => picked.push(index),
		});

		const detach = attached(dialog.root);

		dialog.focus();
		expect(document.activeElement).toBe(dialog.root.querySelectorAll('.tvui-card')[1]);
		dialog.root.querySelectorAll<HTMLElement>('.tvui-card')[2]!.click();
		expect(picked).toEqual([2]);
		detach();
	});
});

describe('media absent dialog (MediaAbsentDialog.kt)', () => {
	it('a01 a title, a body, Skip to next and Exit, with the first action focused', () => {
		const calls: string[] = [];
		const dialog = messageDialog({
			title: 'This episode is not ready yet',
			body: 'The server has no video file for it.',
			actions: [
				{ label: 'Skip to next', run: () => calls.push('skip') },
				{ label: 'Exit', run: () => calls.push('exit') },
			],
		});

		const detach = attached(dialog.root);

		dialog.focus();
		expect(dialog.root.getAttribute('role')).toBe('alertdialog');
		expect(dialog.root.querySelector('.tvui-message-title')?.textContent).toBe('This episode is not ready yet');
		expect(dialog.root.querySelector('.tvui-message-body')?.textContent).toBe('The server has no video file for it.');
		expect(document.activeElement?.textContent).toBe('Skip to next');
		dialog.root.querySelectorAll<HTMLElement>('.tvui-button').forEach((button) => button.click());
		expect(calls).toEqual(['skip', 'exit']);
		detach();
	});
});

describe('pre screen (PreScreenDialog.kt)', () => {
	const options = {
		item: episode({ year: 2020, description: 'A pilot.' }),
		playlistSize: 3,
		episodeCount: 3,
		onPlay: () => undefined,
		onRestart: () => undefined,
		onLanguage: () => undefined,
		onEpisodes: () => undefined,
	};

	const labels = (root: HTMLElement): Array<string | null> =>
		Array.from(root.querySelectorAll('.tvui-pre-buttons .tvui-button')).map((node) => node.textContent);

	it('p13 the title, year, episode count, episode line and overview are drawn', () => {
		const { root } = preScreen(options);

		expect(root.querySelector('.tvui-pre-title')?.textContent).toBe('Show');
		expect(root.querySelector('.tvui-meta')?.textContent).toBe('20203 Episodes');
		expect(root.querySelector('.tvui-pre-episode')?.textContent).toBe('S1E2Pilot');
		expect(root.querySelector('.tvui-pre-overview')?.textContent).toBe('A pilot.');
	});

	it('p14 Play, Restart, Audio and Subtitles come first and Episodes only with a playlist', () => {
		expect(labels(preScreen(options).root)).toEqual(['Play', 'Restart from beginning', 'Audio and Subtitles', 'Episodes']);
		expect(labels(preScreen({ ...options, playlistSize: 1 }).root)).toEqual(['Play', 'Restart from beginning', 'Audio and Subtitles']);
	});

	it('p15 Play takes the initial focus and each button calls its handler', () => {
		const calls: string[] = [];
		const screen = preScreen({
			...options,
			onPlay: () => calls.push('play'),
			onRestart: () => calls.push('restart'),
			onLanguage: () => calls.push('language'),
			onEpisodes: () => calls.push('episodes'),
		});

		const detach = attached(screen.root);

		screen.focus();
		expect(document.activeElement?.textContent).toBe('Play');
		screen.root.querySelectorAll<HTMLElement>('.tvui-pre-buttons .tvui-button').forEach((button) => button.click());
		expect(calls).toEqual(['play', 'restart', 'language', 'episodes']);
		detach();
	});
});

describe('error overlay (ErrorOverlay.kt)', () => {
	const noop = () => undefined;

	it('r01 a network error names the cause, its hint and the raw text, with Retry focused', () => {
		const dialog = errorDialog('network timeout', false, noop, noop);
		const detach = attached(dialog.root);

		dialog.focus();
		expect(dialog.root.querySelector('.tvui-message-title')?.textContent).toBe('Playback Error');
		expect(dialog.root.querySelector('.tvui-message-body')?.textContent).toContain('internet connection');

		const details = Array.from(dialog.root.querySelectorAll('.tvui-message-detail')).map((node) => node.textContent);

		expect(details).toEqual(['Please check your internet connection and try again.', 'network timeout']);
		expect(document.activeElement?.textContent).toBe('Retry');
		detach();
	});

	it('r02 Retry and Exit call their handlers', () => {
		const calls: string[] = [];
		const dialog = errorDialog('boom', false, () => calls.push('retry'), () => calls.push('exit'));

		dialog.root.querySelectorAll<HTMLElement>('.tvui-button').forEach((button) => button.click());
		expect(calls).toEqual(['retry', 'exit']);
	});

	it('r03 a transcode failure uses its own title and hides the raw text', () => {
		const dialog = errorDialog('transcode failed', true, noop, noop);

		expect(dialog.root.querySelector('.tvui-message-title')?.textContent).toBe('Playback stopped');
		expect(dialog.root.querySelector('.tvui-message-detail')).toBeNull();
	});
});

describe('subtitle dialog (SubtitleDialog.kt, the trailer picker)', () => {
	it('s01 one column lists the subtitle choices with a check on the selected one, with no search or auto-skip row', () => {
		const { root } = subtitleDialog({ subtitles: [choice('Off', true), choice('Dutch')] });
		const rows = Array.from(root.querySelectorAll('.tvui-row-label')).map((node) => node.textContent);

		expect(root.querySelectorAll('.tvui-column')).toHaveLength(1);
		expect(root.querySelector('.tvui-column-title')?.textContent).toBe('Subtitle Tracks');
		expect(rows).toEqual(['Off', 'Dutch']);
		expect(root.querySelectorAll('.tvui-selected [data-icon="check"]')).toHaveLength(1);
	});

	it('s02 the selected row takes the initial focus and a pick calls its handler', () => {
		const picked: string[] = [];
		const dialog = subtitleDialog({ subtitles: [choice('Off'), {
			label: 'Dutch',
			selected: true,
			onPick: () => picked.push('Dutch'),
		}] });

		const detach = attached(dialog.root);

		dialog.focus();
		expect(document.activeElement?.textContent).toBe('Dutch');
		(document.activeElement as HTMLElement).click();
		expect(picked).toEqual(['Dutch']);
		detach();
	});
});
