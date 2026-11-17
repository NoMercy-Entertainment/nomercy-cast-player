import type { QueryClient } from '@tanstack/vue-query';

type Json = unknown;

// Any object of this link that already tracks a watchlist flag takes the new value.
function patch(node: Json, link: string, value: boolean): Json {
	if (Array.isArray(node)) {
		let changed = false;
		const next = node.map((item) => {
			const updated = patch(item, link, value);

			changed ||= updated !== item;

			return updated;
		});

		return changed
			? next
			: node;
	}

	if (node === null || typeof node !== 'object')
		return node;

	const record = node as Record<string, Json>;
	let changed = false;
	const next: Record<string, Json> = {};

	for (const [key, child] of Object.entries(record)) {
		const updated = patch(child, link, value);

		changed ||= updated !== child;
		next[key] = updated;
	}

	if (record.link === link && typeof record.watchlist === 'boolean' && record.watchlist !== value) {
		next.watchlist = value;
		changed = true;
	}

	return changed
		? next
		: node;
}

// NMDetailActions.kt:145 updateWatchlistInAllQueries: every cached query showing this title follows the toggle.
export function updateWatchlistInAllQueries(client: QueryClient, link: string, value: boolean): void {
	for (const query of client.getQueryCache().getAll()) {
		const before = query.state.data;
		const after = patch(before, link, value);

		if (after !== before)
			client.setQueryData(query.queryKey, after);
	}
}
