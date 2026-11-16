import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

async function fetchSearch(type: string, query: string): Promise<Component[]> {
	if (query.trim().length < 3)
		return [];

	// APK splits search into /search/video/tv and /search/music/tv. We collapse
	// "all", "movies", "tv shows" into the video endpoint; "music" hits its
	// own endpoint. Each takes ?query= (not ?q=).
	const segment = type === 'music'
		? 'music/tv'
		: 'video/tv';
	const url = `/api/v1/search/${segment}?query=${encodeURIComponent(query)}`;
	const response = await apiFetch<ComponentPayload>({
		path: url,
		method: 'GET',
	});

	return unwrapComponents(response);
}

export function useSearchQuery(type: Ref<string>, queryStr: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.search(type.value, queryStr.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchSearch(type.value, queryStr.value),
		enabled: computed(() => queryStr.value.trim().length >= 3),
		...queryConfigs.realtime,
	});
}
