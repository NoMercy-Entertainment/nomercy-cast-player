import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { apiFetch } from '@/lib/http/client';

export interface InfoVideo {
	site?: string;
	type?: string;
	name?: string;
	src?: string;
	official?: boolean;
}

export interface InfoColorPalette {
	dominant?: string;
	light?: string;
	dark?: string;
	primary?: string;
	lightVibrant?: string;
	darkVibrant?: string;
}

/** EpisodeDto / SeasonDto on the media server (InfoResponseItemDto.Seasons). */
export interface InfoEpisode {
	id?: number;
	episode_number?: number;
	season_number?: number;
	title?: string | null;
	still?: string | null;
	link?: string;
}

export interface InfoSeason {
	id?: number;
	season_number?: number;
	title?: string | null;
	episodes?: InfoEpisode[];
}

/** Person on the wire (InfoResponse.kt Person): a cast or crew credit, writer or director. */
export interface InfoPerson {
	id: number;
	name: string;
	link: string;
	profile?: string | null;
	character?: string | null;
	job?: string | null;
	known_for_department?: string | null;
	order?: string | null;
	color_palette?: InfoColorPalettes;
}

/** A collection member (InfoResponse.kt Related). */
export interface InfoRelated {
	id: number;
	title?: string | null;
	overview?: string | null;
	link: string;
	media_type: string;
	poster?: string | null;
	backdrop?: string | null;
	logo?: string | null;
	year?: number | null;
	duration?: number | null;
	have_items?: number | null;
	number_of_items?: number | null;
	color_palette?: InfoColorPalettes;
}

type InfoColorPalettes = NonNullable<InfoData['color_palette']>;

export interface InfoData {
	id?: string;
	title?: string;
	overview?: string;
	poster?: string;
	backdrop?: string;
	logo?: string;
	color_palette?: {
		backdrop?: InfoColorPalette;
		poster?: InfoColorPalette;
		logo?: InfoColorPalette;
	};
	watched?: boolean;
	favorite?: boolean;
	watchlist?: boolean;
	link?: string;
	year?: number | string;
	duration?: number | string;
	type?: string;
	media_type?: string;
	director?: InfoPerson | null;
	writer?: InfoPerson | null;
	creator?: InfoPerson | null;
	cast?: InfoPerson[];
	crew?: InfoPerson[];
	collection?: InfoRelated[];
	rating?: string;
	voteAverage?: number;
	genres?: Array<{ id?: number; name?: string }>;
	keywords?: Array<string | { name?: string }>;
	videos?: InfoVideo[];
	seasons?: InfoSeason[];
	number_of_items?: number;
	have_items?: number;
}

interface InfoEnvelope {
	data?: InfoData;
}

async function fetchInfo(type: string, id: string): Promise<InfoData> {
	// APK calls /api/v1/{type}/{id} which returns { id, data: {...} }.
	const response = await apiFetch<InfoEnvelope | InfoData>({
		path: `/api/v1/${type}/${id}`,
		method: 'GET',
	});

	if (response && typeof response === 'object' && 'data' in response && response.data)
		return response.data;

	return response as InfoData;
}

export function useInfoQuery(type: Ref<string>, id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.info(type.value, id.value)]);

	const query = useQuery({
		queryKey,
		queryFn: () => fetchInfo(type.value, id.value),
		...queryConfigs.standard,
	});

	// usePageLoadMutationEffect is typed for Component[] queries — info
	// returns a single object, so we skip the auto-mutation hook here.

	return query;
}
