import { useQuery } from '@tanstack/vue-query';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

async function fetchLibraries(): Promise<Component[]> {
	// /api/v1/libraries/tv is the leanback-shaped layout the APK consumes.
	const response = await apiFetch<ComponentPayload>({
		path: '/api/v1/libraries/tv',
		method: 'GET',
	});

	return unwrapComponents(response);
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
