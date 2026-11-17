import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/vue-query';
import { ref, unref } from 'vue';

import { defaultQueryClientOptions } from './client';
import { QueryKeys } from './keys';
import { useSearchQuery } from './useSearchQuery';
import { usePlaylistQuery } from './usePlaylistQuery';

const { captured } = vi.hoisted(() => ({ captured: [] as Array<Record<string, unknown>> }));

vi.mock('@tanstack/vue-query', async (importActual) => ({
	...(await importActual<typeof import('@tanstack/vue-query')>()),
	useQuery: (options: Record<string, unknown>) => {
		captured.push(options);

		return {};
	},
}));

// QueryClient.kt:2237-2241 usePlaylistQuery: the playing list never goes stale or gets collected.
describe('playlist query cache', () => {
	it('keeps the list for the whole session and never refetches it on mount', () => {
		usePlaylistQuery(ref('tv'), ref('1'));
		const options = captured.at(-1);

		expect(options?.staleTime).toBe(Infinity);
		expect(options?.gcTime).toBe(Infinity);
		expect(options?.refetchOnMount).toBe(false);
	});
});

describe('query client defaults', () => {
	it('does not refetch on the browser online event; the hub reconnect recovers', () => {
		expect(defaultQueryClientOptions.defaultOptions.queries.refetchOnReconnect).toBe(false);
	});
});

describe('favorites and my lists keys', () => {
	it('ports the KMP keys', () => {
		expect(QueryKeys.favorites()).toEqual(['favorites']);
		expect(QueryKeys.myLists()).toEqual(['my-lists']);
		expect(QueryKeys.myList('a')).toEqual(['my-lists', 'a']);
	});
});

// SearchScreen.kt:55-60 invalidates the search key on every term, so each search hits the server.
describe('search query', () => {
	it('fetches again for a term it already holds', async () => {
		useSearchQuery(ref('video'), ref('abc'));
		const options = captured.at(-1) as {
			queryKey: unknown;
			queryFn: () => Promise<unknown>;
			staleTime: number;
			refetchOnMount: 'always';
		};
		const queryFn = vi.fn(async () => []);
		const client = new QueryClient();
		const observe = () => new QueryObserver(client, {
			queryKey: unref(options.queryKey) as string[],
			queryFn,
			staleTime: options.staleTime,
			refetchOnMount: options.refetchOnMount,
		}).subscribe(() => undefined);

		const key = unref(options.queryKey) as string[];

		observe()();
		await vi.waitFor(() => expect(client.getQueryData(key)).toEqual([]));
		observe()();

		await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
	});
});
