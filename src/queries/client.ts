import type { QueryClient } from '@tanstack/vue-query';
import { queryConfigs } from './configs';
import { registerQueryClientGetter } from '@/lib/queryShim';

/**
 * Single shared QueryClient. Created in main.ts (not here) so plug-in
 * timing is correct relative to Vue mount; this module exposes a
 * setQueryClient hook used by main.ts and a getter used by query
 * hooks. Cross-layer helpers (shim, invalidate, stale sweep) live in
 * lib/queryShim.ts so stores/ can call them without breaking the
 * stores/ → queries/ boundary rule.
 */
let _client: QueryClient | null = null;

export function setQueryClient(client: QueryClient): void {
	_client = client;

	registerQueryClientGetter(() => {
		if (!_client) {
			throw new Error('QueryClient not initialized — call setQueryClient first');
		}

		return _client;
	});
}

export function getQueryClient(): QueryClient {
	if (!_client) {
		throw new Error('QueryClient not initialized — call setQueryClient first');
	}

	return _client;
}

export const defaultQueryClientOptions = {
	defaultOptions: {
		queries: {
			...queryConfigs.standard,
			retry: 0,
			refetchOnWindowFocus: false,
		},
	},
} as const;

// Re-export shim helpers from queries/client for ergonomics — anything
// that already lives in queries/ can call them from here without a
// second import. Importers in stores/ must use @/lib/queryShim directly.
export {
	invalidateAllLibrary,
	invalidateFromServer,
	mapServerKey,
	staleSweep,
} from '@/lib/queryShim';
