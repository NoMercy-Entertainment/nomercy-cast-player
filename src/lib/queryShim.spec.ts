import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/vue-query';
import {
	createRefreshBatcher,
	invalidateAfterPlayback,
	invalidateAllLibrary,
	invalidateFromServer,
	mapServerKey,
	refreshKeyOf,
	registerQueryClientGetter,
	staleSweep,
	updateTrackFavoriteInAllQueries,
	updateWatchlistInAllQueries,
} from './queryShim';

// QueryClient.kt:1316-1320: home keeps its answer on a revisit, so only an invalidation refreshes it.
const homeContent = { refetchOnMount: false } as const;

// The media server's RefreshLibraryDto serializes as { queryKey: [...] } (#78).
describe('refreshLibrary payload', () => {
	it('reads the queryKey of the object the server sends', () => {
		expect(refreshKeyOf({ queryKey: ['tv', '60808'] })).toEqual(['tv', '60808']);
	});

	it('still reads a bare key list', () => {
		expect(refreshKeyOf(['home'])).toEqual(['home']);
	});

	it('ignores a payload with no key', () => {
		expect(refreshKeyOf({ queryKey: [] })).toBeNull();
		expect(refreshKeyOf(undefined)).toBeNull();
	});
});

describe('refreshLibrary batching', () => {
	it('flushes every distinct key once, 400 ms after the last one', () => {
		vi.useFakeTimers();
		const flushed: string[][] = [];
		const push = createRefreshBatcher(400, (key) =>
			flushed.push([...key]));

		push(['tv', '1']);
		vi.advanceTimersByTime(300);
		push(['tv', '1']);
		push(['home']);
		vi.advanceTimersByTime(399);
		expect(flushed).toEqual([]);
		vi.advanceTimersByTime(1);

		expect(flushed).toEqual([['tv', '1'], ['home']]);
		vi.useRealTimers();
	});
});

// QueryClient.kt:685-706 invalidateFromServer: the key space the server sends.
describe('server key mapping', () => {
	it('maps base/libraries and base/info to the whole library and info prefixes', () => {
		expect(mapServerKey(['base', 'libraries', 'x'])).toEqual([['libraries']]);
		expect(mapServerKey(['base', 'info', '5'])).toEqual([['info']]);
		expect(mapServerKey(['base', 'home'])).toEqual([['home']]);
	});

	it('maps a per-title key to its info entry only, and an id-less one to the type', () => {
		expect(mapServerKey(['tv', '5'])).toEqual([['info', 'tv', '5']]);
		expect(mapServerKey(['movie', '7'])).toEqual([['info', 'movie', '7']]);
		expect(mapServerKey(['movie'])).toEqual([['info', 'movie']]);
		expect(mapServerKey(['tv'])).toEqual([['info', 'tv']]);
	});
});

function clientWith(): QueryClient {
	const client = new QueryClient();

	registerQueryClientGetter(() => client);

	return client;
}

describe('invalidation', () => {
	it('keeps the playing playlist out of invalidateAllLibrary, like KMP', async () => {
		const client = clientWith();
		const fn = vi.fn(async () => 'list');

		const observer = new QueryObserver(client, { queryKey: ['playlist', 'tv', '1'], queryFn: fn });
		const stop = observer.subscribe(() => undefined);

		await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
		invalidateAllLibrary();
		await new Promise((r) => setTimeout(r, 20));
		stop();

		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('refetches an unmounted home query after playback', async () => {
		const client = clientWith();
		const fn = vi.fn(async () => 'home');

		await client.fetchQuery({
			queryKey: ['home'],
			queryFn: fn,
			...homeContent,
		});

		invalidateAfterPlayback(true);

		await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
	});

	it('refetches an unmounted home query on a server refresh', async () => {
		const client = clientWith();
		const fn = vi.fn(async () => 'home');

		await client.fetchQuery({
			queryKey: ['home'],
			queryFn: fn,
			...homeContent,
		});

		invalidateFromServer(['home']);

		await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
	});

	it('refetches an unmounted old query in the stale sweep', async () => {
		const client = clientWith();
		const fn = vi.fn(async () => 'home');

		await client.fetchQuery({
			queryKey: ['home'],
			queryFn: fn,
			...homeContent,
		});

		staleSweep(-1);

		await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
	});
});

// LiveQueueRefresh.kt:40-55: a title's refresh key re-reads the watch list only while that title plays.
describe('live queue refresh', () => {
	function watching(client: QueryClient, key: string[], fn: () => Promise<string>): () => void {
		return new QueryObserver(client, { queryKey: key, queryFn: fn }).subscribe(() => undefined);
	}

	it('refetches the playing title watch list on its refresh key', async () => {
		const client = clientWith();
		const fn = vi.fn(async () => 'list');
		const stop = watching(client, ['playlist', 'tv', '5'], fn);

		await vi.waitFor(() => expect(client.getQueryData(['playlist', 'tv', '5'])).toBe('list'));
		invalidateFromServer(['tv', '5']);

		await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
		stop();
	});

	it('leaves another title and an unwatched title alone', async () => {
		const client = clientWith();
		const other = vi.fn(async () => 'list');
		const idle = vi.fn(async () => 'list');
		const stop = watching(client, ['playlist', 'tv', '6'], other);

		await client.fetchQuery({ queryKey: ['playlist', 'tv', '5'], queryFn: idle });
		await vi.waitFor(() => expect(other).toHaveBeenCalledTimes(1));
		invalidateFromServer(['tv', '5']);
		await new Promise((r) => setTimeout(r, 20));
		stop();

		expect(other).toHaveBeenCalledTimes(1);
		expect(idle).toHaveBeenCalledTimes(1);
	});
});

describe('watchlist toggle propagation', () => {
	it('rewrites every cached info entry of the link and marks list pages stale', () => {
		const client = clientWith();

		client.setQueryData(['info', 'tv', '1'], { link: '/tv/1', watchlist: false });
		client.setQueryData(['info', 'tv', '2'], { link: '/tv/2', watchlist: false });
		client.setQueryData(['home'], []);
		client.setQueryData(['library', 'x'], []);
		client.setQueryData(['search', 'video', 'abc'], []);

		updateWatchlistInAllQueries('/tv/1', true);

		expect(client.getQueryData(['info', 'tv', '1'])).toEqual({ link: '/tv/1', watchlist: true });
		expect(client.getQueryData(['info', 'tv', '2'])).toEqual({ link: '/tv/2', watchlist: false });
		expect(client.getQueryState(['home'])?.isInvalidated).toBe(true);
		expect(client.getQueryState(['library', 'x'])?.isInvalidated).toBe(true);
		expect(client.getQueryState(['search', 'video', 'abc'])?.isInvalidated).toBe(true);
	});
});

describe('music like propagation', () => {
	it('rewrites the list and its tracks in every cached music list', () => {
		const client = clientWith();

		client.setQueryData(['music', 'album', 'a'], {
			link: '/music/albums/a',
			favorite: false,
			tracks: [{ link: '/music/tracks/t', favorite: false }, { link: '/music/tracks/u', favorite: false }],
		});

		client.setQueryData(['music', 'playlist', 'p'], {
			link: '/music/playlists/p',
			favorite: false,
			tracks: [{ link: '/music/tracks/t', favorite: false }],
		});

		client.setQueryData(['favorites'], []);

		updateTrackFavoriteInAllQueries('/music/tracks/t', true);
		updateTrackFavoriteInAllQueries('/music/albums/a', true);

		expect(client.getQueryData(['music', 'album', 'a'])).toEqual({
			link: '/music/albums/a',
			favorite: true,
			tracks: [{ link: '/music/tracks/t', favorite: true }, { link: '/music/tracks/u', favorite: false }],
		});

		expect(client.getQueryData(['music', 'playlist', 'p'])).toMatchObject({ tracks: [{ favorite: true }] });
		expect(client.getQueryState(['favorites'])?.isInvalidated).toBe(true);
	});
});
