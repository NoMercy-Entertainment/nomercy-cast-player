import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { apiFetch } from '@/lib/http/client';
import type { Component, NMLolomoWrapper } from '@/server-components/types';

/*
 * Servers from media-server dev df388299b answer version=lolomo with one NMLolomo of the
 * collection, season, writer and director, cast and crew rows. An older server ignores
 * version and answers the info DTO, which has no components: that is null, and the page
 * builds the rows itself (infoRows.ts).
 */
async function fetchInfoRows(type: string, id: string): Promise<Component[] | null> {
	const response = await apiFetch<ComponentPayload>({
		path: `/api/v1/${type}/${id}?version=lolomo`,
		method: 'GET',
	});
	const lolomo = unwrapComponents(response).find((c) => c.component === 'NMLolomo');

	return lolomo
		? (lolomo.props as NMLolomoWrapper).items ?? []
		: null;
}

export function useInfoRowsQuery(type: Ref<string>, id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.infoRows(type.value, id.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchInfoRows(type.value, id.value),
		...queryConfigs.standard,
	});
}
