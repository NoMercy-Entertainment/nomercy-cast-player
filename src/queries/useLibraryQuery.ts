import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import { apiFetch } from '@/lib/http/client';
import type { Component } from '@/server-components/types';

const LEADING_SLASH = /^\//;

async function fetchLibrary(path: string): Promise<Component[]> {
	// APK calls the library link directly with a ?lolomo&version query — the
	// path comes off the card as e.g. /libraries/01HQ5W2HMZ5QKDSXTTN9EQRERH
	// or /genres/28. We pass that through unchanged after stripping the
	// leading slash so it slots after /api/v1/.
	const cleanPath = path.replace(LEADING_SLASH, '');
	const response = await apiFetch<ComponentPayload>({
		path: `/api/v1/${cleanPath}?version=lolomo`,
		method: 'GET',
	});

	return unwrapComponents(response);
}

export function useLibraryQuery(path: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.library(path.value)]);

	const query = useQuery({
		queryKey,
		queryFn: () => fetchLibrary(path.value),
		...queryConfigs.standard,
	});

	usePageLoadMutationEffect(queryKey, query.data, query.isLoading, query.isFetching);

	return query;
}
