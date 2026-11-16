import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

async function fetchCardItems(link: string): Promise<Component[]> {
	const response = await apiFetch<{ components?: Component[] } | Component[]>({
		path: link.startsWith('/')
			? link
			: `/${link}`,
		method: 'GET',
	});

	if (Array.isArray(response))
		return response;

	return response.components ?? [];
}

/**
 * Used by "more" links on rails to expand a single rail's full result set
 * into a dedicated page. Mirrors android useCardItemsQuery.
 */
export function useCardItemsQuery(link: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.cardItems(link.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchCardItems(link.value),
		...queryConfigs.standard,
	});
}
