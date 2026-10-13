import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

const LEADING_SLASH = /^\//;

async function fetchMusicCards(path: string): Promise<Component[]> {
	const response = await apiFetch<unknown>({
		path: `/api/v1/music/${path.replace(LEADING_SLASH, '')}`,
		method: 'GET',
	});
	if (response && typeof response === 'object' && 'data' in response) {
		const data = (response as { data: unknown }).data;
		if (Array.isArray(data))
			return data as Component[];
		if (data && typeof data === 'object' && 'components' in data)
			return (data as { components: Component[] }).components ?? [];
	}
	if (Array.isArray(response))
		return response as Component[];
	if (response && typeof response === 'object' && 'components' in response)
		return (response as { components: Component[] }).components ?? [];
	return [];
}

export function useMusicCardQuery(path: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.musicCards(path.value)]);

	const query = useQuery({
		queryKey,
		queryFn: () => fetchMusicCards(path.value),
		...queryConfigs.standard,
	});

	usePageLoadMutationEffect(queryKey, query.data, query.isLoading, query.isFetching);

	return query;
}
