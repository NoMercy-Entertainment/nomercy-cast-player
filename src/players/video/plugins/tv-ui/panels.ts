import { el, focusable, formatTime, icon, t } from './dom';
import { episodeLabel, titleAndSubtitle } from './title';
import type { TitledItem } from './title';
import { errorHintKey, errorMessageKey } from './errors';
import { BACKGROUND_CHOICES, FONT_SIZE_CHOICES, mainRows, paneTitleKey, styleRowFocus } from './settingsModel';
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
}

export interface Choice {
	label: string;
	selected: boolean;
	onPick: () => void;
}

function button(label: string, onClick: () => void, iconName?: Parameters<typeof icon>[0]): HTMLElement {
	return focusable(el('button', 'tvui-button', iconName ? icon(iconName) : false, label), onClick);
}

function row(label: string, selected: boolean, onPick: () => void, value = '', trailing: Parameters<typeof icon>[0] | null = null): HTMLElement {
	const node = focusable(el('div', `tvui-row${selected ? ' tvui-selected' : ''}`, el('span', 'tvui-row-label', label), value ? el('span', 'tvui-row-value', value) : false, selected && !trailing ? icon('check') : false, trailing ? icon(trailing) : false), onPick);
	node.setAttribute('role', 'button');
	return node;
}

function column(title: string, rows: HTMLElement[]): HTMLElement {
	return el('div', 'tvui-column', el('h2', 'tvui-column-title', title), ...rows);
}

export function topBar(opts: { item?: UiItem; hasNext: boolean; onSettings: () => void; onNext: () => void }): Panel {
	const { title, subtitle } = titleAndSubtitle(opts.item, t);
	const settings = focusable(el('button', 'tvui-icon-button', icon('settings')), opts.onSettings);
	settings.setAttribute('aria-label', t('player_settings'));
	const next = focusable(el('button', 'tvui-icon-button', icon('next')), opts.onNext);
	next.setAttribute('aria-label', t('player_next_episode'));
	const root = el('div', 'tvui-top-bar', settings, opts.hasNext ? next : false, el('div', 'tvui-titles', el('div', 'tvui-title', title), subtitle ? el('div', 'tvui-subtitle', subtitle) : false));
	return { root, focus: () => settings.focus() };
}

export interface BottomBarHandle extends Panel {
	// override is the scrubbed time while the strip is open (TVBottomBar.kt elapsed readout).
	update: (state: { playing: boolean; time: number; duration: number; buffered: number; override?: number | null; chapters: Array<{ start: number; end: number }> }) => void;
}

export function bottomBar(onPlayPause: () => void): BottomBarHandle {
	const playPause = focusable(el('button', 'tvui-icon-button'), onPlayPause);
	const elapsed = el('span', 'tvui-time');
	const remaining = el('span', 'tvui-time tvui-dim');
	const bar = el('div', 'tvui-chapter-bar');
	bar.setAttribute('role', 'progressbar');
	bar.setAttribute('aria-label', t('player_seek_bar'));
	const root = el('div', 'tvui-bottom-bar', playPause, elapsed, bar, remaining);
	return {
		root,
		focus: () => playPause.focus(),
		update: ({ playing, time, duration, buffered, override, chapters }) => {
			playPause.replaceChildren(icon(playing ? 'pause' : 'play'));
			playPause.setAttribute('aria-label', playing ? t('player_pause') : t('player_play'));
			elapsed.textContent = formatTime(override ?? time);
			remaining.textContent = formatTime(Math.max(duration - time, 0));
			bar.setAttribute('aria-valuetext', t('player_seek_position', { a: formatTime(time), b: formatTime(duration) }));
			const segments = chapters.length > 0 ? chapters : [{ start: 0, end: duration }];
			bar.replaceChildren(...segments.map((chapter, index) => {
				const span = Math.max(chapter.end - chapter.start, 0);
				const fill = el('div', 'tvui-chapter-fill');
				const done = time >= chapter.end ? 1 : time <= chapter.start || span === 0 ? 0 : (time - chapter.start) / span;
				fill.style.width = `${done * 100}%`;
				const seg = el('div', 'tvui-chapter', fill);
				seg.style.flexGrow = String(duration > 0 ? span / duration : 1);
				seg.style.setProperty('--buffered', `${Math.min(buffered, 100)}%`);
				seg.dataset.index = String(index);
				return seg;
			}));
		},
	};
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

// A tile with a sprite frame draws it; without one the tile carries its timestamp (TVSeekContainer.kt:208-226).
export function seekStrip(frameTimes: number[], index: number, thumbnail?: (time: number) => Thumbnail | null): SeekStripHandle {
	const tiles = frameTimes.map((time) => {
		const frame = thumbnail?.(time) ?? null;
		const tile = el('div', 'tvui-seek-tile', frame ? false : formatTime(time));
		if (frame) {
			const art = el('div', 'tvui-seek-frame');
			art.style.cssText = `width:${frame.w}px;height:${frame.h}px;background-image:url("${frame.url}");background-position:-${frame.x}px -${frame.y}px;transform:scale(${TILE_WIDTH / frame.w})`;
			tile.append(art);
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
	return { root, focus: () => root.focus(), select };
}

export function preScreen(opts: { item?: UiItem; playlistSize: number; episodeCount: number; onPlay: () => void; onRestart: () => void; onLanguage: () => void; onEpisodes: () => void }): Panel {
	const { item } = opts;
	const { title } = titleAndSubtitle(item, t);
	const label = item ? episodeLabel(item, t) : null;
	const play = button(t('player_play'), opts.onPlay, 'play');
	const buttons = [play, button(t('player_restart'), opts.onRestart, 'play'), button(t('player_audio_subtitles'), opts.onLanguage, 'globe')];
	if (opts.playlistSize > 1)
		buttons.push(button(t('player_episodes'), opts.onEpisodes, 'playlist1'));
	const meta = el('div', 'tvui-meta', item?.year ? el('span', '', String(item.year)) : false, opts.episodeCount > 0 ? el('span', '', `${opts.episodeCount} ${t('player_episodes')}`) : false);
	const info = el('div', 'tvui-pre-info', el('h1', 'tvui-pre-title', title), meta, el('div', 'tvui-pre-episode', label ? el('span', '', label) : false, item?.title ?? ''), el('p', 'tvui-pre-overview', item?.description ?? item?.overview ?? ''), el('div', 'tvui-pre-buttons', ...buttons));
	return { root: el('div', 'tvui-dialog tvui-pre-screen', info), focus: () => play.focus() };
}

export function episodeDialog(opts: { items: UiItem[]; currentIndex: number; onPick: (index: number) => void }): Panel {
	const seasons = new Map<number, UiItem>();
	for (const item of opts.items) {
		if (item.season != null && !seasons.has(item.season))
			seasons.set(item.season, item);
	}
	const browsing = opts.items[opts.currentIndex]?.season ?? 1;
	const cards = opts.items.map((item, index) => {
		const label = episodeLabel(item, t);
		const art = el('div', 'tvui-card-art');
		if (item.image)
			art.style.backgroundImage = `url("${item.image}")`;
		const percent = item.duration && item.progress?.time ? Math.min(item.progress.time / item.duration, 1) : 0;
		const bar = el('div', 'tvui-card-progress');
		bar.style.width = `${percent * 100}%`;
		const card = row('', index === opts.currentIndex, () => opts.onPick(index));
		card.className = `tvui-card${index === opts.currentIndex ? ' tvui-selected' : ''}`;
		card.replaceChildren(art, percent > 0.01 ? bar : '', el('div', 'tvui-card-text', el('div', 'tvui-card-title', `${label ? `${label} • ` : ''}${item.title ?? t('player_episode', { a: item.episode ?? 0 })}`), el('div', 'tvui-card-overview', item.description ?? item.overview ?? '')));
		return card;
	});
	const seasonRows = [...seasons.entries()].map(([season, item]) => row(item.seasonName ?? (season === 0 ? t('player_extras') : t('player_season', { a: season })), season === browsing, () => cards[opts.items.findIndex(i => i.season === season)]?.focus()));
	const root = el('div', 'tvui-dialog tvui-episodes', el('div', 'tvui-seasons', ...seasonRows), el('div', 'tvui-episode-list', ...cards));
	return { root, focus: () => (cards[opts.currentIndex] ?? cards[0])?.focus() };
}

export function languageDialog(opts: { quality: Choice[]; audio: Choice[]; subtitles: Choice[]; autoSkip: boolean; onToggleAutoSkip: () => void; onSearch: () => void }): Panel {
	const toRows = (choices: Choice[]): HTMLElement[] => choices.map(choice => row(choice.label, choice.selected, choice.onPick));
	const columns: HTMLElement[] = [];
	if (opts.quality.length > 1)
		columns.push(column(t('player_quality'), toRows(opts.quality)));
	if (opts.audio.length > 1)
		columns.push(column(t('dialog_audio_tracks'), toRows(opts.audio)));
	columns.push(column(t('dialog_subtitle_tracks'), [...toRows(opts.subtitles), row(t('player_subtitle_search_online'), false, opts.onSearch)]));
	columns.push(column(t('section_playback'), [row(t('settings_auto_skip_chapters'), opts.autoSkip, opts.onToggleAutoSkip)]));
	const root = el('div', 'tvui-dialog tvui-languages', ...columns);
	return { root, focus: () => (root.querySelector<HTMLElement>('.tvui-selected') ?? root.querySelector<HTMLElement>('[data-focusable]'))?.focus() };
}

export interface SettingsData {
	nav: SettingsNav;
	levels: Choice[];
	subtitles: Choice[];
	audio: Choice[];
	values: { quality: string; subtitle: string; audio: string };
	autoSkip: boolean;
	style: { font: string; size: number; edge: string; color: string; background: number };
	styleChoices: (prop: StyleProp) => Choice[];
	open: (pane: SettingsNav['pane'], prop?: StyleProp) => void;
	onBack: () => void;
	onRestart: () => void;
	onToggleAutoSkip: () => void;
	onResetStyle: () => void;
}

export function settingsPanel(data: SettingsData): Panel {
	const { nav } = data;
	const back = focusable(el('button', 'tvui-icon-button', icon('chevronLeft')), data.onBack);
	back.setAttribute('aria-label', t('close'));
	const title = nav.pane === 'subtitleStyle' && nav.styleProp ? t(`subtitle_style_${nav.styleProp === 'fontFamily' ? 'font' : nav.styleProp === 'fontSize' ? 'font_size' : nav.styleProp === 'edgeStyle' ? 'edge' : nav.styleProp === 'textColor' ? 'color' : 'background'}`) : t(paneTitleKey(nav.pane));
	let rows: HTMLElement[] = [];
	const choiceRows = (choices: Choice[]): HTMLElement[] => choices.map(choice => row(choice.label, choice.selected, choice.onPick));
	if (nav.pane === 'main') {
		const enabled = mainRows({ levels: data.levels.length, textTracks: data.subtitles.length - 1, audioTracks: data.audio.length });
		const make = (id: string, label: string, value: string, onClick: () => void, trailing: Parameters<typeof icon>[0] | null = 'chevronRight'): HTMLElement => {
			const node = row(label, false, onClick, value, trailing);
			if (!enabled.find(entry => entry.id === id)?.enabled)
				node.setAttribute('aria-disabled', 'true');
			return node;
		};
		rows = [
			make('audio', t('dialog_audio_tracks'), data.values.audio, () => data.open('audio')),
			make('subtitle', t('dialog_subtitle_tracks'), data.values.subtitle, () => data.open('subtitle')),
			make('subtitleStyle', t('subtitle_style'), '', () => data.open('subtitleStyle')),
			make('quality', t('player_quality'), data.values.quality, () => data.open('quality')),
			make('autoSkip', t('settings_auto_skip_chapters_short'), data.autoSkip ? t('settings_state_on') : t('settings_state_off'), data.onToggleAutoSkip, null),
			make('restart', t('player_restart'), '', data.onRestart, null),
		];
	}
	else if (nav.pane === 'quality') {
		rows = choiceRows(data.levels);
	}
	else if (nav.pane === 'subtitle') {
		rows = choiceRows(data.subtitles);
	}
	else if (nav.pane === 'audio') {
		rows = choiceRows(data.audio);
	}
	else if (nav.styleProp) {
		rows = choiceRows(data.styleChoices(nav.styleProp));
	}
	else {
		const s = data.style;
		const open = (prop: StyleProp) => () => data.open('subtitleStyle', prop);
		rows = [
			row(t('subtitle_style_font'), false, open('fontFamily'), s.font, 'chevronRight'),
			row(t('subtitle_style_font_size'), false, open('fontSize'), `${s.size}sp`, 'chevronRight'),
			row(t('subtitle_style_edge'), false, open('edgeStyle'), s.edge, 'chevronRight'),
			row(t('subtitle_style_color'), false, open('textColor'), s.color, 'chevronRight'),
			row(t('subtitle_style_background'), false, open('background'), s.background === 0 ? t('subtitle_style_background_transparent') : `${Math.round(s.background * 100)}%`, 'chevronRight'),
			row(t('subtitle_style_reset'), false, data.onResetStyle),
		];
	}
	const root = el('div', 'tvui-settings', el('div', 'tvui-sidebar', el('div', 'tvui-sidebar-header', back, el('span', '', title)), el('div', 'tvui-sidebar-rows', ...rows)));
	const focusTarget = (): HTMLElement | null => {
		const current = styleRowFocus(rows.map(node => node.classList.contains('tvui-selected')));
		const enabled = rows.filter(node => !node.hasAttribute('aria-disabled'));
		return rows.some(node => node.classList.contains('tvui-selected')) ? rows[current] ?? null : enabled[0] ?? null;
	};
	return { root, focus: () => focusTarget()?.focus() };
}

export function messageDialog(opts: { title: string; body?: string; actions: Array<{ label: string; run: () => void }>; error?: string | null }): Panel {
	const buttons = opts.actions.map(action => button(action.label, action.run));
	const root = el('div', 'tvui-dialog tvui-message', el('h2', 'tvui-message-title', opts.title), opts.body ? el('p', 'tvui-message-body', opts.body) : false, opts.error ? el('p', 'tvui-message-detail', opts.error) : false, el('div', 'tvui-pre-buttons', ...buttons));
	root.setAttribute('role', 'alertdialog');
	return { root, focus: () => buttons[0]?.focus() };
}

export function errorDialog(error: string | null, transcodeFailed: boolean, onRetry: () => void, onExit: () => void): Panel {
	const hint = errorHintKey(error);
	const message = t(errorMessageKey(error));
	const panel = messageDialog({
		title: transcodeFailed ? t('transcode_error_title') : t('error_playback'),
		body: message,
		error: error && error !== message && !transcodeFailed ? error : null,
		actions: [{ label: t('action_retry'), run: onRetry }, { label: t('media_absent_exit'), run: onExit }],
	});
	if (hint)
		panel.root.querySelector('.tvui-message-body')?.after(el('p', 'tvui-message-detail', t(hint)));
	return panel;
}

export interface SearchView {
	status: 'loading' | 'results' | 'empty' | 'error' | 'rateLimited' | 'downloading' | 'downloaded' | 'downloadError';
	results: SubtitleCandidate[];
	onPick: (candidate: SubtitleCandidate) => void;
	onClose: () => void;
}

// SubtitleSearchDialog.kt:60-300: title and close, a status line, then the candidate rows.
export function subtitleSearchPanel(view: SearchView): Panel {
	const close = focusable(el('button', 'tvui-icon-button', icon('chevronLeft')), view.onClose);
	close.setAttribute('aria-label', t('close'));
	const notice: Partial<Record<SearchView['status'], string>> = {
		loading: t('subtitle_search_loading'),
		downloading: t('subtitle_search_downloading'),
		downloaded: t('subtitle_search_download_success'),
		downloadError: t('subtitle_search_download_error'),
		error: t('subtitle_search_error'),
		rateLimited: t('subtitle_search_rate_limited'),
		empty: t('subtitle_search_empty'),
	};
	const rows = view.status === 'loading' || view.status === 'error' || view.status === 'rateLimited'
		? []
		: view.results.map((candidate) => {
				const label = candidate.releaseName ?? candidate.fileName ?? candidate.language;
				const extra = candidate.hearingImpaired ? `, ${t('subtitle_search_hearing_impaired')}` : '';
				const node = focusable(el('div', 'tvui-row tvui-result', el('div', 'tvui-row-label', el('div', 'tvui-result-language', candidate.languageName), el('div', 'tvui-result-release', label)), el('span', 'tvui-row-value', `${t('subtitle_search_downloads_count', { a: candidate.downloads })}${extra}`)), () => view.onPick(candidate));
				node.setAttribute('role', 'button');
				return node;
			});
	const status = notice[view.status === 'results' ? 'empty' : view.status];
	const root = el('div', 'tvui-dialog tvui-search', el('div', 'tvui-search-card', el('div', 'tvui-sidebar-header', close, el('span', '', t('subtitle_search_title'))), view.status === 'results' && rows.length > 0 ? false : el('p', 'tvui-message-detail', status ?? ''), notice[view.status] && view.status !== 'empty' && view.status !== 'results' && rows.length > 0 ? el('p', 'tvui-message-detail', notice[view.status] ?? '') : false, el('div', 'tvui-sidebar-rows', ...rows)));
	root.setAttribute('role', 'dialog');
	return { root, focus: () => (rows[0] ?? close).focus() };
}

export function volumeIndicator(volume: number, muted: boolean): HTMLElement {
	const name = muted || volume === 0 ? 'volumeMuted' : volume > 0.7 ? 'volumeThree' : volume > 0.4 ? 'volumeTwo' : 'volumeOne';
	return el('div', 'tvui-volume', icon(name), el('span', '', muted || volume === 0 ? t('player_muted') : `${Math.round(volume * 100)}%`));
}

export { BACKGROUND_CHOICES, FONT_SIZE_CHOICES };
