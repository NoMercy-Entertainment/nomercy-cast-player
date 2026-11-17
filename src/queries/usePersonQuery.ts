import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

// version=lolomo answers the page as components: an NMHomeCard hero, then one NMLolomo of credit rows.
async function fetchPerson(id: string): Promise<Component[]> {
	const response = await apiFetch<ComponentPayload>({
		path: `/api/v1/person/${id}?version=lolomo`,
		method: 'GET',
	});

	return unwrapComponents(response);
}

export function usePersonQuery(id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.person(id.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchPerson(id.value),
		...queryConfigs.standard,
	});
}
