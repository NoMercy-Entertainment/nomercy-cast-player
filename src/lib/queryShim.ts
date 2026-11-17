import type { QueryClient } from '@tanstack/vue-query';
import type { RefreshLibraryPayload } from '@/lib/signalr/events';

/**
 * Server-key → client-key shim per spec §6.2.
 *
 * Lives in lib/ rather than queries/ because the socketStore (which
 * lives in stores/) needs to call invalidateFromServer on RefreshLibrary
 * events. Per spec §7.1, stores/ is allowed to import from lib/ but not
 * from queries/.
 *
 * The QueryClient singleton is owned by queries/client.ts; this module
 * re-uses it via a getter passed in at registration time. Phase 2's
 * main.ts registers the singleton, then both queries/ and stores/
 * resolve it through here.
 */

let getClient: (() => QueryClient) | null = null;

export function registerQueryClientGetter(getter: () => QueryClient): void {
	getClient = getter;
}

// The server sends RefreshLibraryDto as { queryKey: [...] }; a bare list is kept for older senders.
export function refreshKeyOf(payload: RefreshLibraryPayload | undefined): string[] | null {
	const key = payload && 'queryKey' in payload
		? payload.queryKey
		: payload;

	return Array.isArray(key) && key.length > 0
		? key.map(String)
		: null;
}

// KMP batches RefreshLibrary keys for 400 ms and flushes each distinct key once (SharedMainScreen.kt:606-617).
export function createRefreshBatcher(
	windowMs: number,
	flush: (key: readonly string[]) => void,
): (key: readonly string[]) => void {
	const pending = new Map<string, readonly string[]>();
	let timer: ReturnType<typeof setTimeout> | null = null;

	return (key) => {
		pending.set(JSON.stringify(key), key);

		if (timer !== null) {
			clearTimeout(timer);
		}

		timer = setTimeout(() => {
			timer = null;
			const batch = [...pending.values()];

			pending.clear();
			batch.forEach(flush);
		}, windowMs);
	};
}

export function mapServerKey(serverKey: readonly string[]) {
	if (!Array.isArray(serverKey) || serverKey.length === 0)
		return [] as const satisfies readonly (readonly string[])[];

	const head = serverKey[0];
	// The server publishes two-element per-title keys — ["movie","<id>"] and
	// ["tv","<id>"] — so the id sits at index 1, not 2. Reading index 2 left it
	// undefined and silently dropped every per-title invalidation.
	const id = serverKey[1];

	// QueryClient.kt:685-706: 'base' is dropped; libraries and info collapse to their prefix.
	if (head === 'base' && serverKey.length > 1) {
		const rest = serverKey.slice(1);

		if (rest[0] === 'libraries')
			return [['libraries']] as const satisfies readonly (readonly string[])[];

		if (rest[0] === 'info')
			return [['info']] as const satisfies readonly (readonly string[])[];

		return [rest] as const satisfies readonly (readonly string[])[];
	}

	if (head === 'movie' || head === 'tv') {
		return [id !== undefined
			? ['info', head, id]
			: ['info', head]] as const satisfies readonly (readonly string[])[];
	}

	return [serverKey] as const satisfies readonly (readonly string[])[];
}

// QueryClient.kt:634-659: an invalidation force-fetches every matching query, mounted or not.
const REFETCH_ALL = 'all' as const;

export function invalidateFromServer(serverKey: readonly string[]): void {
	const client = getClient?.();

	if (!client) return;

	for (const clientKey of mapServerKey(serverKey)) {
		void client.invalidateQueries({
			queryKey: [...clientKey],
			exact: false,
			refetchType: REFETCH_ALL,
		});
	}

	// LiveQueueRefresh.kt:40-55: only a title being played re-reads its watch list; the player merges new items.
	const [type, id] = serverKey;

	if ((type === 'tv' || type === 'movie') && id !== undefined) {
		void client.refetchQueries({
			queryKey: ['playlist', type, id],
			exact: true,
			type: 'active',
		});
	}
}

export function invalidateAllLibrary(): void {
	const client = getClient?.();

	if (!client) return;

	for (const prefix of [
		'home',
		'libraries',
		'library',
		'info',
		'card-items',
		'music',
		'search',
		'person',
		'component',
	]) {
		void client.invalidateQueries({
			queryKey: [prefix],
			exact: false,
			refetchType: REFETCH_ALL,
		});
	}
}

interface LinkedEntry {
	link?: string;
	favorite?: boolean;
	watchlist?: boolean;
	tracks?: LinkedEntry[];
}

// QueryClient.kt:936-969: the watchlist flag follows the link into every cached info page; list pages go stale.
export function updateWatchlistInAllQueries(link: string, watchlist: boolean): void {
	const client = getClient?.();

	if (!client) return;

	for (const query of client.getQueryCache().findAll({ queryKey: ['info'] })) {
		const current = query.state.data as LinkedEntry | undefined;

		if (current?.link === link) {
			client.setQueryData(query.queryKey, { ...current, watchlist });
		}
	}

	for (const prefix of ['home', 'library', 'search']) {
		void client.invalidateQueries({
			queryKey: [prefix],
			exact: false,
			refetchType: 'none',
		});
	}
}

// QueryClient.kt:777-853: a like rewrites the list itself or the matching tracks in every cached music list.
export function updateTrackFavoriteInAllQueries(link: string, favorite: boolean): void {
	const client = getClient?.();

	if (!client) return;

	for (const query of client.getQueryCache().findAll({ queryKey: ['music'] })) {
		const current = query.state.data as LinkedEntry | undefined;

		if (!current || typeof current !== 'object') continue;

		if (current.link === link) {
			client.setQueryData(query.queryKey, { ...current, favorite });

			continue;
		}

		if (current.tracks?.some((track) => track.link === link)) {
			client.setQueryData(query.queryKey, {
				...current,
				tracks: current.tracks.map((track) =>
					track.link === link
						? { ...track, favorite }
						: track),
			});
		}
	}

	void client.invalidateQueries({
		queryKey: ['favorites'],
		exact: true,
		refetchType: 'none',
	});
}

/**
 * Drops every plugin answer this screen is holding.
 *
 * A plugin pushes when its own data changed, and it also pushes when what the
 * account may see changed. Both end the same way: the wall re-reads the
 * placements and every view drawn from them, rather than keeping a row for a
 * plugin the account no longer has.
 */
export function invalidatePlugins(): void {
	const client = getClient?.();

	if (!client) return;

	void client.invalidateQueries({ queryKey: ['plugins'], exact: false });
}

/** NoMercyApplication.kt:760-787: a foreground after 10 s away refreshes the library; every foreground sweeps. */
export const ForegroundThresholdMs = 10_000;

export function createForegroundWatch(
	refresh: () => void,
	sweep: () => void,
	now: () => number = Date.now,
) {
	let hiddenAt: number | null = null;

	return {
		hidden: () => {
			hiddenAt = now();
		},
		visible: () => {
			if (hiddenAt !== null && now() - hiddenAt >= ForegroundThresholdMs) {
				refresh();
			}

			hiddenAt = null;
			sweep();
		},
	} as const satisfies { hidden: () => void; visible: () => void };
}

/** WatchScreen.kt:705-716: leaving the player refreshes home and libraries, exact, only when something played. */
export function invalidateAfterPlayback(played: boolean): void {
	const client = getClient?.();

	if (!client || !played) return;

	void client.invalidateQueries({
		queryKey: ['home'],
		exact: true,
		refetchType: REFETCH_ALL,
	});

	void client.invalidateQueries({
		queryKey: ['libraries'],
		exact: true,
		refetchType: REFETCH_ALL,
	});
}

export function staleSweep(maxAgeMs = 3 * 60 * 60_000): void {
	const client = getClient?.();

	if (!client) return;

	const cutoff = Date.now() - maxAgeMs;
	const queries = client.getQueryCache().getAll();

	for (const q of queries) {
		if (q.state.dataUpdatedAt > 0 && q.state.dataUpdatedAt < cutoff) {
			void client.invalidateQueries({
				queryKey: q.queryKey,
				exact: true,
				refetchType: REFETCH_ALL,
			});
		}
	}
}
