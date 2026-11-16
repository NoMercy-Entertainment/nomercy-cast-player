import { useQuery } from '@tanstack/vue-query';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

export interface HomeResponse {
	components: Component[];
}

async function fetchHome(): Promise<Component[]> {
	// /api/v1/home/tv is the leanback-shaped server-driven layout the APK
	// consumes — ordering, first rails, hero are tuned for TV. The /home
	// endpoint without /tv returns the mobile-shaped layout.
	const response = await apiFetch<ComponentPayload>({
		path: '/api/v1/home/tv',
		method: 'GET',
	});

	return unwrapComponents(response);
}

export function useHomeQuery() {
	const query = useQuery({
		queryKey: [...QueryKeys.home()],
		queryFn: fetchHome,
		...queryConfigs.homeContent,
	});

	usePageLoadMutationEffect(
		[...QueryKeys.home()],
		query.data,
		query.isLoading,
		query.isFetching,
	);

	return query;
}
