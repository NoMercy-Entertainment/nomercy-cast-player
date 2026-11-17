import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

// APK splits search into /search/video/tv and /search/music/tv: "music" has its own
// endpoint, every other type uses the video one. Each takes ?query= (not ?q=).
async function fetchSearchPage(type: string, encoded: string): Promise<ComponentPayload> {
	if (type === 'music') {
		return apiFetch<ComponentPayload>({
			path: `/api/v1/search/music/tv?query=${encoded}`,
			method: 'GET',
		});
	}

	return apiFetch<ComponentPayload>({
		path: `/api/v1/search/video/tv?query=${encoded}`,
		method: 'GET',
	});
}

async function fetchSearch(type: string, query: string): Promise<Component[]> {
	if (query.length < 3)
		return [];

	const response = await fetchSearchPage(type, encodeURIComponent(query));

	return unwrapComponents(response);
}

export function useSearchQuery(type: Ref<string>, queryStr: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.search(type.value, queryStr.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchSearch(type.value, queryStr.value),
		enabled: computed(() => queryStr.value.length >= 3),
		...queryConfigs.realtime,
		// SearchScreen.kt:55-60: every term change invalidates its key, so each search hits the server.
		staleTime: 0,
		refetchOnMount: 'always',
	});
}
