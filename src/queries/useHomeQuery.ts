import { useQuery } from '@tanstack/vue-query';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
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
	const response = await apiFetch<unknown>({
		path: '/api/v1/home/tv',
		method: 'GET',
	});

	// Server-driven endpoints wrap their payload in { id, data } envelopes
	// (per the dashboard envelope-strip pattern in nomercy-app-web). Unwrap
	// one level before falling back to the legacy shapes.
	if (response && typeof response === 'object' && 'data' in response) {
		const data = (response as { data: unknown }).data;

		if (Array.isArray(data))
			return data as Component[];

		if (data && typeof data === 'object' && 'components' in data)
			return (data as { components: Component[] }).components;
	}

	if (Array.isArray(response))
		return response as Component[];

	if (response && typeof response === 'object' && 'components' in response)
		return (response as HomeResponse).components;

	return [];
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
