const TRAILING_ELLIPSIS = /…$/;

export interface TitledItem {
	title?: string;
	show?: string;
	season?: number | null;
	episode?: number | null;
	playlistType?: string;
	videoType?: string;
}

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

function nonSeasonal(item: TitledItem): boolean {
	const kind = [item.playlistType, item.videoType];

	return (item.season == null || item.season === 0) && (kind.includes('special') || kind.includes('collection'));
}

// TVTopBar.kt playerTitleAndSubtitle and PreScreenDialog.kt: S1E2, Extras E3, or the bare number.
export function episodeLabel(item: TitledItem, t: Translate): string | null {
	if (item.episode == null)
		return null;

	if (nonSeasonal(item))
		return String(item.episode);

	const episode = t('player_e', { a: item.episode });

	if (item.season === 0)
		return `${t('player_extras')} ${episode}`;

	if (item.season != null)
		return `${t('player_s', { a: item.season })}${episode}`;

	return null;
}

export function titleAndSubtitle(item: TitledItem | undefined, t: Translate): { title: string; subtitle: string } {
	const loading = t('player_loading');

	const real = (text?: string): string | undefined => {
		const value = text?.trim();

		return value && value.toLowerCase() !== loading.toLowerCase() && value.toLowerCase() !== loading.replace(TRAILING_ELLIPSIS, '').toLowerCase()
			? value
			: undefined;
	};

	if (!item)
		return { title: loading, subtitle: '' };

	const show = item.show?.trim();
	const title = show || real(item.title) || loading;

	if (!show)
		return { title, subtitle: '' };

	const label = episodeLabel(item, t);
	const episodeTitle = real(item.title);

	if (episodeTitle) {
		return { title, subtitle: label
			? `${label} • ${episodeTitle}`
			: '' };
	}

	return { title, subtitle: label ?? '' };
}
