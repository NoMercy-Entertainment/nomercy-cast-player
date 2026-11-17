import { el, focusable, formatTime, icon, t } from './dom';
import type { IconName } from './dom';
import { episodeLabel, titleAndSubtitle } from './title';
import type { TitledItem } from './title';
import { errorHintKey, errorMessageKey } from './errors';
import {
	BACKGROUND_CHOICES,
	FONT_SIZE_CHOICES,
	mainRows,
	paneTitleKey,
	styleRowFocus,
} from './settingsModel';
import type { SettingsNav, StyleProp } from './state';
import type { SubtitleCandidate } from './subtitleSearch';

export interface Panel {
	root: HTMLElement;
	focus: () => void;
}

export interface UiItem extends TitledItem {
	id?: number | string;
	description?: string;
	overview?: string;
	image?: string;
	backdrop?: string;
	year?: number;
	duration?: number;
	seasonName?: string;
	progress?: { time?: number };
	tracks?: Array<{ kind?: string; file?: string }>;
}

export interface Choice {
	label: string;
	selected: boolean;
	onPick: () => void;
}

const STYLE_TITLES = {
	fontFamily: 'font',
	fontSize: 'font_size',
	edgeStyle: 'edge',
	textColor: 'color',
	background: 'background',
} as const satisfies Record<StyleProp, string>;

function button(label: string, onClick: () => void, iconName?: IconName): HTMLElement {
	const glyph = iconName
		? icon(iconName)
		: false;

	return focusable(el('button', 'tvui-button', glyph, label), onClick);
}

function iconButton(name: IconName, label: string, onClick: () => void): HTMLElement {
	const glyph = icon(name);
	const node = focusable(el('button', 'tvui-icon-button', glyph), onClick);

	node.setAttribute('aria-label', label);

	return node;
}

function row(
	label: string,
	selected: boolean,
	onPick: () => void,
	value = '',
	trailing: IconName | null = null,
): HTMLElement {
	const classes = selected
		? 'tvui-row tvui-selected'
		: 'tvui-row';

	const current = value
		? el('span', 'tvui-row-value', value)
		: false;

	const check = selected && !trailing
		? icon('check')
		: false;

	const arrow = trailing
		? icon(trailing)
		: false;

	const name = el('span', 'tvui-row-label', label);
	const text = el('span', 'tvui-row-text', name, current);
	const node = focusable(el('div', classes, text, check, arrow), onPick);

	node.setAttribute('role', 'button');

	return node;
}

function column(titleKey: string, rows: HTMLElement[]): HTMLElement {
	const title = el('h2', 'tvui-column-title', t(titleKey));

	return el('div', 'tvui-column', title, ...rows);
}

function choiceRows(choices: Choice[]): HTMLElement[] {
	return choices.map((choice) => row(choice.label, choice.selected, choice.onPick));
}

// The first choice is Auto, which is not a real level: a lone real level is no choice (KMP levels.size > 1).
function hasQualityChoice(levels: Choice[]): boolean {
	return levels.length - 1 > 1;
}

export function topBar(opts: {
	item?: UiItem;
	hasNext: boolean;
	onSettings: () => void;
	onNext: () => void;
}) {
	const { title, subtitle } = titleAndSubtitle(opts.item, t);
	const settings = iconButton('settings', t('player_settings'), opts.onSettings);
	const next = iconButton('next', t('player_next_episode'), opts.onNext);
	const second = subtitle
		? el('div', 'tvui-subtitle', subtitle)
		: false;

	const titles = el('div', 'tvui-titles', el('div', 'tvui-title', title), second);
	const root = el('div', 'tvui-top-bar', settings, opts.hasNext
		? next
		: false, titles);

	return { root, focus: () => settings.focus() } as const satisfies Panel;
}

export interface BottomBarState {
	playing: boolean;
	time: number;
	duration: number;
	buffered: number;
	// The scrubbed time while the strip is open (TVBottomBar.kt elapsed readout).
	override?: number | null;
	chapters: Array<{ start: number; end: number }>;
}

export interface BottomBarHandle extends Panel {
	update: (state: BottomBarState) => void;
}

function fillShare(time: number, start: number, end: number): number {
	const span = Math.max(end - start, 0);

	if (time >= end)
		return 1;

	if (time <= start || span === 0)
		return 0;

	return (time - start) / span;
}

function chapterSegment(
	chapter: { start: number; end: number },
	index: number,
	state: BottomBarState,
): HTMLElement {
	const span = Math.max(chapter.end - chapter.start, 0);
	const fill = el('div', 'tvui-chapter-fill');
	const grow = state.duration > 0
		? span / state.duration
		: 1;

	fill.style.width = `${fillShare(state.time, chapter.start, chapter.end) * 100}%`;
	const segment = el('div', 'tvui-chapter', fill);

	segment.style.flexGrow = String(grow);
	segment.style.setProperty('--buffered', `${Math.min(state.buffered, 100)}%`);
	segment.dataset.index = String(index);

	return segment;
}

export function bottomBar(onPlayPause: () => void) {
	const playPause = focusable(el('button', 'tvui-icon-button'), onPlayPause);
	const elapsed = el('span', 'tvui-time');
	const remaining = el('span', 'tvui-time tvui-dim');
	const bar = el('div', 'tvui-chapter-bar');

	bar.setAttribute('role', 'progressbar');
	bar.setAttribute('aria-label', t('player_seek_bar'));
	const root = el('div', 'tvui-bottom-bar', playPause, elapsed, bar, remaining);

	const update = (state: BottomBarState): void => {
		const label = state.playing
			? t('player_pause')
			: t('player_play');

		const spoken = { a: formatTime(state.time), b: formatTime(state.duration) };
		const whole = [{ start: 0, end: state.duration }];
		const segments = state.chapters.length > 0
			? state.chapters
			: whole;

		playPause.replaceChildren(icon(state.playing
			? 'pause'
			: 'play'));

		playPause.setAttribute('aria-label', label);
		elapsed.textContent = formatTime(state.override ?? state.time);
		remaining.textContent = formatTime(Math.max(state.duration - state.time, 0));
		bar.setAttribute('aria-valuetext', t('player_seek_position', spoken));
		bar.replaceChildren(...segments.map((chapter, index) => chapterSegment(chapter, index, state)));
	};

	return {
		root,
		focus: () => playPause.focus(),
		update,
	} as const satisfies BottomBarHandle;
}

export interface SeekStripHandle extends Panel {
	select: (index: number) => void;
}

export interface Thumbnail {
	url: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

const TILE_WIDTH = 280;

function frameArt(frame: Thumbnail): HTMLElement {
	const art = el('div', 'tvui-seek-frame');
	const position = `background-position:-${frame.x}px -${frame.y}px`;
	const size = `width:${frame.w}px;height:${frame.h}px`;

	art.style.cssText = `${size};background-image:url("${frame.url}");${position};` +
		`transform:scale(${TILE_WIDTH / frame.w})`;

	return art;
}

// A tile with a sprite frame draws it; without one the tile carries its timestamp (TVSeekContainer.kt:208-226).
export function seekStrip(
	frameTimes: number[],
	index: number,
	thumbnail?: (time: number) => Thumbnail | null,
) {
	const tiles = frameTimes.map((time) => {
		const frame = thumbnail?.(time) ?? null;
		const tile = el('div', 'tvui-seek-tile', frame
			? false
			: formatTime(time));

		if (frame) {
			tile.append(frameArt(frame));
		}

		tile.setAttribute('aria-label', t('player_seek_preview_at', { a: formatTime(time) }));

		return tile;
	});

	const root = el('div', 'tvui-seek-strip', ...tiles);

	root.setAttribute('aria-label', t('player_seek_previews'));
	root.tabIndex = 0;

	const select = (next: number): void => {
		tiles.forEach((tile, i) => tile.classList.toggle('tvui-seek-selected', i === next));
		tiles[next]?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
	};

	select(index);

	return {
		root,
		focus: () => root.focus(),
		select,
	} as const satisfies SeekStripHandle;
}

export function preScreen(opts: {
	item?: UiItem;
	playlistSize: number;
	episodeCount: number;
	onPlay: () => void;
	onRestart: () => void;
	onLanguage: () => void;
	onEpisodes: () => void;
}) {
	const { item } = opts;
	const { title } = titleAndSubtitle(item, t);
	const label = item
		? episodeLabel(item, t)
		: null;

	const play = button(t('player_play'), opts.onPlay, 'play');
	const restart = button(t('player_restart'), opts.onRestart, 'play');
	const languages = button(t('player_audio_subtitles'), opts.onLanguage, 'globe');
	const buttons = [play, restart, languages];

	if (opts.playlistSize > 1) {
		const episodes = button(t('player_episodes'), opts.onEpisodes, 'playlist1');

		buttons.push(episodes);
	}

	const year = item?.year
		? el('span', '', String(item.year))
		: false;

	const count = opts.episodeCount > 0
		? el('span', '', `${opts.episodeCount} ${t('player_episodes')}`)
		: false;

	const tag = label
		? el('span', '', label)
		: false;

	const meta = el('div', 'tvui-meta', year, count);
	const episode = el('div', 'tvui-pre-episode', tag, item?.title ?? '');
	const overview = el('p', 'tvui-pre-overview', item?.description ?? item?.overview ?? '');
	const actions = el('div', 'tvui-pre-buttons', ...buttons);
	const heading = el('h1', 'tvui-pre-title', title);
	const info = el('div', 'tvui-pre-info', heading, meta, episode, overview, actions);
	const root = el('div', 'tvui-dialog tvui-pre-screen', info);

	return { root, focus: () => play.focus() } as const satisfies Panel;
}

function episodeCard(
	item: UiItem,
	index: number,
	current: number,
	onPick: (index: number) => void,
) {
	const label = episodeLabel(item, t);
	const art = el('div', 'tvui-card-art');
	const prefix = label
		? `${label} • `
		: '';

	const heading = `${prefix}${item.title ?? t('player_episode', { a: item.episode ?? 0 })}`;
	const percent = item.duration && item.progress?.time
		? Math.min(item.progress.time / item.duration, 1)
		: 0;

	const bar = el('div', 'tvui-card-progress');
	const text = el('div', 'tvui-card-text', el('div', 'tvui-card-title', heading));
	const card = row('', index === current, () =>
		onPick(index));

	if (item.image) {
		art.style.backgroundImage = `url("${item.image}")`;
	}

	text.append(el('div', 'tvui-card-overview', item.description ?? item.overview ?? ''));
	bar.style.width = `${percent * 100}%`;

	card.className = index === current
		? 'tvui-card tvui-selected'
		: 'tvui-card';

	card.replaceChildren(art, percent > 0.01
		? bar
		: '', text);

	return card;
}

function seasonName(season: number, item: UiItem): string {
	if (item.seasonName)
		return item.seasonName;

	return season === 0
		? t('player_extras')
		: t('player_season', { a: season });
}

export function episodeDialog(opts: {
	items: readonly UiItem[];
	currentIndex: number;
	onPick: (index: number) => void;
}) {
	const seasons = new Map<number, UiItem>();

	for (const item of opts.items) {
		if (item.season != null && !seasons.has(item.season)) {
			seasons.set(item.season, item);
		}
	}

	const browsing = opts.items[opts.currentIndex]?.season ?? 1;
	const { currentIndex, onPick } = opts;
	const cards = opts.items.map((item, index) => episodeCard(item, index, currentIndex, onPick));
	const seasonRows = [...seasons.entries()].map(([season, item]) => {
		const first = opts.items.findIndex((i) => i.season === season);

		return row(seasonName(season, item), season === browsing, () =>
			cards[first]?.focus());
	});

	const list = el('div', 'tvui-episode-list', ...cards);
	const root = el('div', 'tvui-dialog tvui-episodes', el('div', 'tvui-seasons', ...seasonRows), list);

	const focus = (): void => (cards[currentIndex] ?? cards[0])?.focus();

	return { root, focus } as const satisfies Panel;
}

function focusSelected(root: HTMLElement): void {
	const target = root.querySelector<HTMLElement>('.tvui-selected') ??
		root.querySelector<HTMLElement>('[data-focusable]');

	target?.focus();
}

export function languageDialog(opts: {
	quality: Choice[];
	audio: Choice[];
	subtitles: Choice[];
	autoSkip: boolean;
	onToggleAutoSkip: () => void;
	onSearch: () => void;
}) {
	const columns: HTMLElement[] = [];
	const search = row(t('player_subtitle_search_online'), false, opts.onSearch);
	const skip = row(t('settings_auto_skip_chapters'), opts.autoSkip, opts.onToggleAutoSkip);
	const subtitles = [...choiceRows(opts.subtitles), search];

	if (hasQualityChoice(opts.quality)) {
		const levels = choiceRows(opts.quality);

		columns.push(column('player_quality', levels));
	}

	if (opts.audio.length > 1) {
		const tracks = choiceRows(opts.audio);

		columns.push(column('dialog_audio_tracks', tracks));
	}

	columns.push(column('dialog_subtitle_tracks', subtitles));
	columns.push(column('section_playback', [skip]));
	const root = el('div', 'tvui-dialog tvui-languages', ...columns);

	return { root, focus: () => focusSelected(root) } as const satisfies Panel;
}

// SubtitleDialog.kt: the trailer's picker, the subtitle column of the language dialog on its own.
export function subtitleDialog(opts: { subtitles: Choice[] }) {
	const rows = choiceRows(opts.subtitles);
	const root = el('div', 'tvui-dialog tvui-languages', column('dialog_subtitle_tracks', rows));

	return { root, focus: () => focusSelected(root) } as const satisfies Panel;
}

export interface SettingsData {
	nav: SettingsNav;
	// The first level is Auto; the rest are the real ones.
	levels: Choice[];
	subtitles: Choice[];
	audio: Choice[];
	values: {
		quality: string;
		subtitle: string;
		audio: string;
	};
	autoSkip: boolean;
	style: {
		font: string;
		size: number;
		edge: string;
		color: string;
		background: number;
	};
	styleChoices: (prop: StyleProp) => Choice[];
	open: (pane: SettingsNav['pane'], prop?: StyleProp) => void;
	onBack: () => void;
	onRestart: () => void;
	onToggleAutoSkip: () => void;
	onResetStyle: () => void;
}

function mainPaneRows(data: SettingsData): HTMLElement[] {
	const enabled = mainRows({
		levels: data.levels.length - 1,
		textTracks: data.subtitles.length - 1,
		audioTracks: data.audio.length,
	});

	const make = (
		id: string,
		label: string,
		value: string,
		onClick: () => void,
		trailing: IconName | null = 'chevronRight',
	): HTMLElement => {
		const node = row(label, false, onClick, value, trailing);

		if (!enabled.find((entry) => entry.id === id)?.enabled) {
			node.setAttribute('aria-disabled', 'true');
		}

		return node;
	};

	const autoSkip = data.autoSkip
		? t('settings_state_on')
		: t('settings_state_off');

	return [
		make('audio', t('dialog_audio_tracks'), data.values.audio, () =>
			data.open('audio')),
		make('subtitle', t('dialog_subtitle_tracks'), data.values.subtitle, () =>
			data.open('subtitle')),
		make('subtitleStyle', t('subtitle_style'), '', () =>
			data.open('subtitleStyle')),
		make('quality', t('player_quality'), data.values.quality, () =>
			data.open('quality')),
		make('autoSkip', t('settings_auto_skip_chapters_short'), autoSkip, data.onToggleAutoSkip, null),
		make('restart', t('player_restart'), '', data.onRestart, null),
	];
}

function stylePaneRows(data: SettingsData): HTMLElement[] {
	const s = data.style;
	const open = (prop: StyleProp) => () => data.open('subtitleStyle', prop);
	const background = s.background === 0
		? t('subtitle_style_background_transparent')
		: `${Math.round(s.background * 100)}%`;

	return [
		row(t('subtitle_style_font'), false, open('fontFamily'), s.font, 'chevronRight'),
		row(t('subtitle_style_font_size'), false, open('fontSize'), `${s.size}sp`, 'chevronRight'),
		row(t('subtitle_style_edge'), false, open('edgeStyle'), s.edge, 'chevronRight'),
		row(t('subtitle_style_color'), false, open('textColor'), s.color, 'chevronRight'),
		row(t('subtitle_style_background'), false, open('background'), background, 'chevronRight'),
		row(t('subtitle_style_reset'), false, data.onResetStyle),
	];
}

function settingsRows(data: SettingsData): HTMLElement[] {
	const { nav } = data;

	switch (nav.pane) {
		case 'main':
			return mainPaneRows(data);
		case 'quality':
			return choiceRows(data.levels);
		case 'subtitle':
			return choiceRows(data.subtitles);
		case 'audio':
			return choiceRows(data.audio);
		case 'subtitleStyle':
			return nav.styleProp
				? choiceRows(data.styleChoices(nav.styleProp))
				: stylePaneRows(data);
	}
}

function settingsTitle(nav: SettingsNav): string {
	return nav.pane === 'subtitleStyle' && nav.styleProp
		? t(`subtitle_style_${STYLE_TITLES[nav.styleProp]}`)
		: t(paneTitleKey(nav.pane));
}

export function settingsPanel(data: SettingsData) {
	const back = iconButton('chevronLeft', t('close'), data.onBack);
	const rows = settingsRows(data);
	const title = el('span', '', settingsTitle(data.nav));
	const header = el('div', 'tvui-sidebar-header', back, title);
	const list = el('div', 'tvui-sidebar-rows', ...rows);
	const root = el('div', 'tvui-settings', el('div', 'tvui-sidebar', header, list));

	const focusTarget = (): HTMLElement | null => {
		const selected = rows.map((node) => node.classList.contains('tvui-selected'));

		if (selected.includes(true))
			return rows[styleRowFocus(selected)] ?? null;

		return rows.find((node) => !node.hasAttribute('aria-disabled')) ?? null;
	};

	return { root, focus: () => focusTarget()?.focus() } as const satisfies Panel;
}

export function messageDialog(opts: {
	title: string;
	body?: string;
	actions: Array<{ label: string; run: () => void }>;
	error?: string | null;
}) {
	const buttons = opts.actions.map((action) => button(action.label, action.run));
	const body = opts.body
		? el('p', 'tvui-message-body', opts.body)
		: false;

	const detail = opts.error
		? el('p', 'tvui-message-detail', opts.error)
		: false;

	const actions = el('div', 'tvui-pre-buttons', ...buttons);
	const heading = el('h2', 'tvui-message-title', opts.title);
	const root = el('div', 'tvui-dialog tvui-message', heading, body, detail, actions);

	root.setAttribute('role', 'alertdialog');

	return { root, focus: () => buttons[0]?.focus() } as const satisfies Panel;
}

export function errorDialog(
	error: string | null,
	transcodeFailed: boolean,
	onRetry: () => void,
	onExit: () => void,
): Panel {
	const hint = errorHintKey(error);
	const message = t(errorMessageKey(error));
	const title = transcodeFailed
		? t('transcode_error_title')
		: t('error_playback');

	const panel = messageDialog({
		title,
		body: message,
		error: error && error !== message && !transcodeFailed
			? error
			: null,
		actions: [{ label: t('action_retry'), run: onRetry }, { label: t('media_absent_exit'), run: onExit }],
	});

	if (hint) {
		const detail = el('p', 'tvui-message-detail', t(hint));

		panel.root.querySelector('.tvui-message-body')?.after(detail);
	}

	return panel;
}

export interface SearchView {
	status: 'loading' | 'results' | 'empty' | 'error' | 'rateLimited' | 'downloading' | 'downloaded' | 'downloadError';
	results: SubtitleCandidate[];
	onPick: (candidate: SubtitleCandidate) => void;
}

const SEARCH_NOTICES = {
	loading: 'subtitle_search_loading',
	downloading: 'subtitle_search_downloading',
	downloaded: 'subtitle_search_download_success',
	downloadError: 'subtitle_search_download_error',
	error: 'subtitle_search_error',
	rateLimited: 'subtitle_search_rate_limited',
	empty: 'subtitle_search_empty',
} as const satisfies Partial<Record<SearchView['status'], string>>;

function statusMark(status: keyof typeof SEARCH_NOTICES): HTMLElement | false {
	switch (status) {
		case 'loading':
		case 'downloading':
			return el('div', 'tvui-spinner');
		case 'downloaded':
			return icon('check');
		case 'empty':
			return false;
		default:
			return icon('alertTriangle');
	}
}

// SubtitleSearchDialog.kt:133-208 (TvStatusRow): a status replaces the list until there are results.
function statusRow(status: keyof typeof SEARCH_NOTICES): HTMLElement {
	const text = el('span', '', t(SEARCH_NOTICES[status]));
	const node = el('div', 'tvui-status', statusMark(status), text);

	node.setAttribute('role', 'status');

	return node;
}

// SubtitleSearchDialog.kt:240-293 (TvSubtitleResultRow).
function resultRow(candidate: SubtitleCandidate, onPick: () => void): HTMLElement {
	const label = candidate.releaseName ?? candidate.fileName ?? candidate.language;
	const downloads = t('subtitle_search_downloads_count', { a: candidate.downloads });
	const rating = t('subtitle_search_rating', { a: candidate.rating.toFixed(1) });
	const parts = [downloads, rating];

	if (candidate.hearingImpaired) {
		parts.push(t('subtitle_search_hearing_impaired'));
	}

	const language = el('div', 'tvui-result-language', candidate.languageName);
	const release = el('div', 'tvui-result-release', label);
	const meta = el('div', 'tvui-result-meta', parts.join(' • '));
	const text = el('div', 'tvui-row-label', language, release, meta);
	const node = focusable(el('div', 'tvui-row tvui-result', text), onPick);

	node.setAttribute('role', 'button');

	return node;
}

// Back is the only exit, as in KMP (the dialog has no close control).
export function subtitleSearchPanel(view: SearchView) {
	const showList = view.status === 'results' && view.results.length > 0;
	const rows = showList
		? view.results.map((candidate) => resultRow(candidate, () =>
				view.onPick(candidate)))
		: [];

	const body = showList
		? el('div', 'tvui-sidebar-rows', ...rows)
		: statusRow(view.status === 'results'
				? 'empty'
				: view.status);

	const title = el('div', 'tvui-search-title', t('subtitle_search_title'));
	const root = el('div', 'tvui-dialog tvui-search', el('div', 'tvui-search-card', title, body));

	root.setAttribute('role', 'dialog');
	root.tabIndex = -1;

	return { root, focus: () => (rows[0] ?? root).focus() } as const satisfies Panel;
}

export function volumeIndicator(volume: number, muted: boolean): HTMLElement {
	const silent = muted || volume === 0;
	const name = volumeIcon(volume, silent);
	const label = silent
		? t('player_muted')
		: `${Math.round(volume * 100)}%`;

	return el('div', 'tvui-volume', icon(name), el('span', '', label));
}

function volumeIcon(volume: number, silent: boolean): IconName {
	if (silent)
		return 'volumeMuted';

	if (volume > 0.7)
		return 'volumeThree';

	return volume > 0.4
		? 'volumeTwo'
		: 'volumeOne';
}

export { BACKGROUND_CHOICES, FONT_SIZE_CHOICES };
