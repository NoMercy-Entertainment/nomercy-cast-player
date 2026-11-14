import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { apiFetch } from '@/lib/http/client';

export interface PlaylistItem {
	id: number | string;
	title: string;
	duration?: string | number;
	videoId?: string;
	resume_at?: number;
	// Full shape comes from server; receiver reads only fields it uses.
	[k: string]: unknown;
}

export interface PlaylistResponse {
	item: PlaylistItem | undefined;
	playlist: PlaylistItem[];
}

// The media server answers /watch with a bare array of playable items (TvShowsController.Watch).
export function toPlaylistResponse(body: PlaylistItem[] | PlaylistResponse): PlaylistResponse {
	if (Array.isArray(body))
		return { item: body[0], playlist: body };
	return body;
}

async function fetchPlaylist(type: string, id: string): Promise<PlaylistResponse> {
	const body = await apiFetch<PlaylistItem[] | PlaylistResponse>({
		path: `/api/v1/${type}/${id}/watch`,
		method: 'GET',
	});
	return toPlaylistResponse(body);
}

export function usePlaylistQuery(type: Ref<string>, id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.playlist(type.value, id.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchPlaylist(type.value, id.value),
		...queryConfigs.standard,
	});
}
