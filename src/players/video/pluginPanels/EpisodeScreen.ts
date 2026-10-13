/**
 * EpisodeScreen panel — playlist picker matching APK EpisodeDialog. Two
 * columns: seasons on the left (1f weight), episode cards on the right
 * (2f weight). Each episode card has a backdrop thumbnail, S#E# badge,
 * duration, progress fill, title and description — same shape as
 * Leanback's EpisodeCard.
 *
 * DOM-driven so the npm video-player can mount it directly into the
 * player overlay element.
 */

import { dispatchOptionAction } from './shared';

export interface EpisodeItem {
	id: number | string;
	season?: number | null;
	episode?: number | null;
	title: string;
	description?: string | null;
	image?: string | null;
	duration?: number;
	progressMs?: number;
	playlistType?: string | null;
	videoType?: string | null;
	seasonName?: string | null;
}

export interface EpisodeScreenOptions {
	parent: HTMLElement;
	episodes: EpisodeItem[];
	currentId?: number | string;
	currentTimeMs?: number;
	imageBaseUrl?: string;
	onPick: (item: EpisodeItem) => void;
	onExit: () => void;
}

export function mountEpisodeScreen(opts: EpisodeScreenOptions): () => void {
	const root = document.createElement('div');
	root.className = 'panel episode-screen';
	root.setAttribute('role', 'dialog');
	root.setAttribute('aria-label', 'Episodes');

	const layout = document.createElement('div');
	layout.className = 'episode-layout';

	const seasonCol = document.createElement('aside');
	seasonCol.className = 'episode-season-col';

	const episodeCol = document.createElement('section');
	episodeCol.className = 'episode-list';

	const seasons = collectSeasons(opts.episodes);
	const isNonSeasonal
		= opts.episodes.length > 0
			&& (opts.episodes[0]?.playlistType === 'collection'
				|| opts.episodes[0]?.playlistType === 'special'
				|| opts.episodes[0]?.videoType === 'collection'
				|| opts.episodes[0]?.videoType === 'special');

	const currentEpisode = opts.episodes.find(ep => ep.id === opts.currentId);
	let selectedSeason = currentEpisode?.season ?? seasons[0]?.season ?? 1;

	const renderEpisodes = (): void => {
		episodeCol.innerHTML = '';
		const filtered = opts.episodes.filter((ep) => {
			if (isNonSeasonal)
				return true;
			return (ep.season ?? 1) === selectedSeason;
		});
		for (const ep of filtered) {
			const isPlaying = ep.id === opts.currentId;
			const card = makeEpisodeCard(ep, isPlaying, opts.currentTimeMs ?? null, () => {
				opts.onPick(ep);
			});
			episodeCol.append(card);
		}
	};

	// Rendering never moves focus: a season's focus handler renders, and the
	// D-pad has to stay on that season to browse the next one.
	const focusEpisodes = (): void => {
		const focused = episodeCol.querySelector<HTMLElement>('.episode-card.is-playing')
			?? episodeCol.querySelector<HTMLElement>('[data-focusable]');
		focused?.focus();
		focused?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
	};

	for (const s of seasons) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'panel-button season-row';
		btn.dataset.focusable = 'true';
		btn.tabIndex = 0;
		btn.dataset.seasonNumber = String(s.season ?? 0);
		if (s.season === selectedSeason)
			btn.classList.add('current');
		btn.textContent = labelForSeason(s, isNonSeasonal);
		btn.addEventListener('focus', () => {
			selectedSeason = s.season ?? 1;
			seasonCol
				.querySelectorAll<HTMLElement>('.season-row')
				.forEach(el => el.classList.toggle(
					'current',
					Number(el.dataset.seasonNumber) === selectedSeason,
				));
			renderEpisodes();
		});
		btn.addEventListener('click', () => {
			selectedSeason = s.season ?? 1;
			seasonCol
				.querySelectorAll<HTMLElement>('.season-row')
				.forEach(el => el.classList.toggle(
					'current',
					Number(el.dataset.seasonNumber) === selectedSeason,
				));
			renderEpisodes();
			focusEpisodes();
		});
		seasonCol.append(btn);
	}

	layout.append(seasonCol, episodeCol);
	root.append(layout);
	opts.parent.append(root);

	renderEpisodes();
	focusEpisodes();
	requestAnimationFrame(() => {
		const target = episodeCol.querySelector<HTMLElement>('.is-playing')
			?? episodeCol.querySelector<HTMLElement>('[data-focusable]')
			?? seasonCol.querySelector<HTMLElement>('.current')
			?? seasonCol.querySelector<HTMLElement>('[data-focusable]');
		target?.focus();
	});

	const onKey = (e: KeyboardEvent): void => {
		if (e.key === 'Escape' || e.key === 'Back' || e.key === 'GoBack' || e.key === 'BrowserBack') {
			e.preventDefault();
			opts.onExit();
			return;
		}
		const active = document.activeElement;
		if (e.key === 'ArrowRight' && active && seasonCol.contains(active)) {
			e.preventDefault();
			const target = episodeCol.querySelector<HTMLElement>('.is-playing')
				?? episodeCol.querySelector<HTMLElement>('[data-focusable]');
			target?.focus();
		}
		else if (e.key === 'ArrowLeft' && active && episodeCol.contains(active)) {
			e.preventDefault();
			const target = seasonCol.querySelector<HTMLElement>('.current')
				?? seasonCol.querySelector<HTMLElement>('[data-focusable]');
			target?.focus();
		}
	};
	root.addEventListener('keydown', onKey, true);
	dispatchOptionAction(root, seasonCol, 'vertical');
	dispatchOptionAction(root, episodeCol, 'vertical');

	return (): void => {
		root.removeEventListener('keydown', onKey, true);
		root.remove();
	};
}

interface SeasonGroup {
	season: number | null | undefined;
	seasonName: string | null | undefined;
	playlistType: string | null | undefined;
	videoType: string | null | undefined;
}

function collectSeasons(episodes: EpisodeItem[]): SeasonGroup[] {
	const map = new Map<string, SeasonGroup>();
	for (const ep of episodes) {
		const key = String(ep.season ?? '_');
		if (!map.has(key)) {
			map.set(key, {
				season: ep.season,
				seasonName: ep.seasonName,
				playlistType: ep.playlistType,
				videoType: ep.videoType,
			});
		}
	}
	return [...map.values()].sort((a, b) => (a.season ?? 0) - (b.season ?? 0));
}

function labelForSeason(group: SeasonGroup, isNonSeasonal: boolean): string {
	if (group.seasonName)
		return group.seasonName;
	if (isNonSeasonal && (group.playlistType === 'collection' || group.videoType === 'collection'))
		return 'Collection';
	if (isNonSeasonal && (group.playlistType === 'special' || group.videoType === 'special'))
		return 'Extras';
	if (group.season === 0)
		return 'Extras';
	return `Season ${group.season ?? 1}`;
}

function makeEpisodeCard(
	ep: EpisodeItem,
	isPlaying: boolean,
	currentTimeMs: number | null,
	onClick: () => void,
): HTMLElement {
	const card = document.createElement('button');
	card.type = 'button';
	card.className = `episode-card${isPlaying ? ' is-playing' : ''}`;
	card.dataset.focusable = 'true';
	card.tabIndex = 0;
	card.addEventListener('click', () => onClick());

	const thumb = document.createElement('div');
	thumb.className = 'episode-thumb';
	if (ep.image) {
		const img = document.createElement('img');
		img.src = ep.image;
		img.alt = '';
		img.decoding = 'async';
		img.loading = 'lazy';
		thumb.append(img);
	}

	const overlay = document.createElement('div');
	overlay.className = 'episode-thumb-overlay';
	thumb.append(overlay);

	const meta = document.createElement('div');
	meta.className = 'episode-thumb-meta';
	const badge = document.createElement('span');
	badge.className = 'episode-badge';
	badge.textContent = badgeForEpisode(ep);
	meta.append(badge);

	if (ep.duration != null && ep.duration > 0) {
		const dur = document.createElement('span');
		dur.className = 'episode-duration';
		dur.textContent = formatDurationSec(ep.duration);
		meta.append(dur);
	}
	thumb.append(meta);

	const progressMs = isPlaying && currentTimeMs != null ? currentTimeMs : ep.progressMs;
	const durationMs = (ep.duration ?? 0) * 1000;
	if (progressMs && durationMs > 0) {
		const pct = Math.min(1, Math.max(0, progressMs / durationMs));
		if (pct > 0.01) {
			const bar = document.createElement('div');
			bar.className = 'episode-progress';
			const fill = document.createElement('div');
			fill.className = 'episode-progress-fill';
			fill.style.width = `${(pct * 100).toFixed(1)}%`;
			bar.append(fill);
			thumb.append(bar);
		}
	}

	card.append(thumb);

	const info = document.createElement('div');
	info.className = 'episode-info';
	const title = document.createElement('p');
	title.className = 'episode-title';
	title.textContent = ep.title;
	info.append(title);

	if (ep.description) {
		const desc = document.createElement('p');
		desc.className = 'episode-description';
		desc.textContent = ep.description;
		info.append(desc);
	}
	card.append(info);

	return card;
}

function badgeForEpisode(ep: EpisodeItem): string {
	const isNonSeasonal
		= ep.season === 0
			&& (ep.playlistType === 'special' || ep.playlistType === 'collection'
				|| ep.videoType === 'special' || ep.videoType === 'collection');
	if (isNonSeasonal)
		return `A${ep.episode ?? 0}`;
	if (ep.season === 0)
		return `Extras E${ep.episode ?? 0}`;
	if (ep.season != null && ep.episode != null)
		return `S${ep.season}E${ep.episode}`;
	return ep.title;
}

function formatDurationSec(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0)
		return `${h}h ${m}m`;
	if (m > 0)
		return `${m}m ${s.toString().padStart(2, '0')}s`;
	return `${s}s`;
}
