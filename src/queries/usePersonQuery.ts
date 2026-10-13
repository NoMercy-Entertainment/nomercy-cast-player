import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

async function fetchPerson(id: string): Promise<Component[]> {
	const response = await apiFetch<{ components?: Component[] } | Component[]>({
		path: `/api/v1/person/${id}`,
		method: 'GET',
	});
	if (Array.isArray(response))
		return response;
	return response.components ?? [];
}

export function usePersonQuery(id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.person(id.value)]);

	const query = useQuery({
		queryKey,
		queryFn: () => fetchPerson(id.value),
		...queryConfigs.static,
	});

	usePageLoadMutationEffect(queryKey, query.data, query.isLoading, query.isFetching);

	return query;
}
