import { useQuery } from '@tanstack/vue-query';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

async function fetchMusicStart(): Promise<Component[]> {
	const response = await apiFetch<ComponentPayload>({
		path: '/api/v1/music/start',
		method: 'GET',
	});

	return unwrapComponents(response);
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
