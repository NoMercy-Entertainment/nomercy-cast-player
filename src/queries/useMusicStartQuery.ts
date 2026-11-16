import { useQuery } from '@tanstack/vue-query';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

async function fetchMusicStart(): Promise<Component[]> {
	const response = await apiFetch<unknown>({
		path: '/api/v1/music/start',
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

export function useMusicStartQuery() {
	const query = useQuery({
		queryKey: [...QueryKeys.musicStart()],
		queryFn: fetchMusicStart,
		...queryConfigs.standard,
	});

	usePageLoadMutationEffect(
		[...QueryKeys.musicStart()],
		query.data,
		query.isLoading,
		query.isFetching,
	);

	return query;
}
