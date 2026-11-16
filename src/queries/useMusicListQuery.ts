import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { apiFetch } from '@/lib/http/client';

export interface MusicTrack {
	id?: string;
	title?: string;
	disc?: number | string;
	track?: number | string;
	duration?: number | string;
	cover?: string;
	link?: string;
	artist_track?: Array<{ name?: string; id?: string }>;
}

export interface MusicListData {
	id?: string;
	type?: string;
	title?: string;
	cover?: string;
	overview?: string;
	description?: string;
	link?: string;
	favorite?: boolean;
	year?: number | string;
	artists?: string[];
	tracks?: MusicTrack[];
	color_palette?: Partial<Record<'cover' | 'image' | 'backdrop' | 'profile', {
		primary?: string;
		dominant?: string;
		light?: string;
		dark?: string;
	}>>;
}

interface MusicListEnvelope {
	data?: MusicListData;
}

async function fetchMusicList(type: string, id: string): Promise<MusicListData> {
	// APK calls /api/v1/music/{type}/{id} — returns { id, data: MusicList }.
	const response = await apiFetch<MusicListEnvelope | MusicListData>({
		path: `/api/v1/music/${type}/${id}`,
		method: 'GET',
	});

	if (response && typeof response === 'object' && 'data' in response && response.data)
		return response.data;

	return response as MusicListData;
}

export function useMusicListQuery(type: Ref<string>, id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.musicLists(type.value, id.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchMusicList(type.value, id.value),
		...queryConfigs.standard,
	});
}
