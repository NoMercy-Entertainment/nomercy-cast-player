import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { apiFetch } from '@/lib/http/client';
import type { Chapter } from '@nomercy-entertainment/nomercy-player-core';

export interface PlaylistTrack {
	kind?: string;
	file?: string;
}

export interface PlaylistItem {
	id: number | string;
	title: string;
	duration?: string | number;
	videoId?: string;
	resume_at?: number;
	season?: number | string;
	episode?: number | string;
	tracks?: PlaylistTrack[];
	/** Parsed from the chapter track before playback; the player reads them inline. */
	chapters?: Chapter[];
}

export interface PlaylistResponse {
	item: PlaylistItem | undefined;
	playlist: PlaylistItem[];
}

// The media server answers /watch with a bare array of playable items (TvShowsController.Watch).
export function toPlaylistResponse(body: PlaylistItem[] | PlaylistResponse) {
	if (Array.isArray(body))
		return { item: body[0], playlist: body } as const satisfies PlaylistResponse;

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
		...queryConfigs.playlist,
	});
}
