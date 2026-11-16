import { useQuery } from '@tanstack/vue-query';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

interface LibrariesResponse {
	components?: Component[];
}

async function fetchLibraries(): Promise<Component[]> {
	// /api/v1/libraries/tv is the leanback-shaped layout the APK consumes.
	const response = await apiFetch<unknown>({
		path: '/api/v1/libraries/tv',
		method: 'GET',
	});

	// /api/v1/* endpoints wrap responses in { id, data } envelopes.
	if (response && typeof response === 'object' && 'data' in response) {
		const data = (response as { data: unknown }).data;

		if (Array.isArray(data))
			return data as Component[];

		if (data && typeof data === 'object' && 'components' in data)
			return (data as LibrariesResponse).components ?? [];
	}

	if (Array.isArray(response))
		return response as Component[];

	if (response && typeof response === 'object' && 'components' in response)
		return (response as LibrariesResponse).components ?? [];

	return [];
}

export function useLibrariesQuery() {
	const query = useQuery({
		queryKey: [...QueryKeys.libraries()],
		queryFn: fetchLibraries,
		...queryConfigs.standard,
	});

	usePageLoadMutationEffect(
		[...QueryKeys.libraries()],
		query.data,
		query.isLoading,
		query.isFetching,
	);

	return query;
}
