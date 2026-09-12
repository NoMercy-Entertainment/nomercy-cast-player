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
	director?: string | string[];
	writer?: string | string[];
	creator?: string | string[];
	rating?: string;
	voteAverage?: number;
	genres?: Array<{ id?: number; name?: string }>;
	keywords?: Array<string | { name?: string }>;
	videos?: InfoVideo[];
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
