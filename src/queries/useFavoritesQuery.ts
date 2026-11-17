import { useQuery } from '@tanstack/vue-query';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { apiFetch } from '@/lib/http/client';
import type { Component, NMCardWrapper } from '@/server-components/types';

const GRID_ID = 'favorites-grid';

// FavoritesRepository.kt:46-74: the flat card list becomes one NMGrid; card ids carry the type as ids collide across tables.
async function fetchFavorites(): Promise<Component[]> {
	const response = await apiFetch<{ data?: NMCardWrapper[] } | NMCardWrapper[]>({
		path: '/api/v1/userData/favorites',
		method: 'GET',
	});
	const cards = Array.isArray(response)
		? response
		: (response?.data ?? []);

	if (cards.length === 0)
		return [];

	const items = cards.map((card) => ({
		id: `${card.type}-${card.id}`,
		component: 'NMCard',
		props: {
			id: String(card.id),
			title: card.title,
			data: card,
		},
	}) as const satisfies Component);

	return [{
		id: GRID_ID,
		component: 'NMGrid',
		props: { id: GRID_ID, items },
	}];
}

export function useFavoritesQuery() {
	return useQuery({
		queryKey: [...QueryKeys.favorites()],
		queryFn: fetchFavorites,
		...queryConfigs.standard,
	});
}
