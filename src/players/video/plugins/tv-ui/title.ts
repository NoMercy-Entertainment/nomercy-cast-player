const TRAILING_ELLIPSIS = /…$/;

export interface TitledItem {
	title?: string;
	show?: string;
	season?: number | null;
	episode?: number | null;
	playlistType?: string;
	videoType?: string;
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

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

// Codes Intl.DisplayNames does not know (nomercy-video-player desktop-ui/data/language-names.ts).
const ISO3_QUIRKS = new Map<string, string>([['bra', 'pt-BR'], ['pob', 'pt-BR']]);

function languageName(code: string | undefined, locale: string): string | null {
	if (!code)
		return null;

	const bcp47 = ISO3_QUIRKS.get(code) ?? code;

	try {
		const name = new Intl.DisplayNames([locale, 'en'], { type: 'language', fallback: 'none' }).of(bcp47);

		return name && name !== bcp47 && name !== code
			? name
			: null;
	} catch {
		return null;
	}
}

export interface LabeledTrack {
	label: string;
	language?: string;
	type?: string;
	default?: boolean;
}

// The web player reports no audio selection until one is picked;
// the stream then plays its default track, or the first.
export function playingAudioIndex(
	selected: number | null,
	tracks: readonly LabeledTrack[],
): number | null {
	if (selected !== null)
		return selected;

	if (!tracks.length)
		return null;

	const preferred = tracks.findIndex((track) => track.default);

	return preferred >= 0
		? preferred
		: 0;
}

// The track row text KMP shows (player core languageDisplayName + variant): "English (Full)", "Japanese".
export function trackLabel(track: LabeledTrack, locale: string): string {
	const language = languageName(track.language, locale);
	const raw = track.label.trim();
	const variant = (track.type ?? raw).trim();
	const isVariant = variant !== '' && variant.toLowerCase() !== track.language?.toLowerCase() &&
		variant.toLowerCase() !== language?.toLowerCase();

	if (language && isVariant)
		return `${language} (${variant.charAt(0).toUpperCase()}${variant.slice(1)})`;

	return language ?? raw;
}

export function titleAndSubtitle(
	item: TitledItem | undefined,
	t: Translate,
): { title: string; subtitle: string } {
	const loading = t('player_loading');
	const placeholders = [loading, loading.replace(TRAILING_ELLIPSIS, '')].map((text) => text.toLowerCase());

	const real = (text?: string): string | undefined => {
		const value = text?.trim();

		return value && !placeholders.includes(value.toLowerCase())
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
