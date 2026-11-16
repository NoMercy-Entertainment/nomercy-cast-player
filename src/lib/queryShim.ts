import type { QueryClient } from '@tanstack/vue-query';

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
export function refreshKeyOf(payload: unknown): string[] | null {
	const key = Array.isArray(payload) ? payload : (payload as { queryKey?: unknown } | null | undefined)?.queryKey;
	return Array.isArray(key) && key.length > 0 ? key.map(String) : null;
}

// KMP batches RefreshLibrary keys for 400 ms and flushes each distinct key once (SharedMainScreen.kt:606-617).
export function createRefreshBatcher(windowMs: number, flush: (key: readonly string[]) => void): (key: readonly string[]) => void {
	const pending = new Map<string, readonly string[]>();
	let timer: ReturnType<typeof setTimeout> | null = null;
	return (key) => {
		pending.set(JSON.stringify(key), key);
		if (timer !== null)
			clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			const batch = [...pending.values()];
			pending.clear();
			batch.forEach(flush);
		}, windowMs);
	};
}

export function mapServerKey(serverKey: readonly string[]): readonly (readonly string[])[] {
	if (!Array.isArray(serverKey) || serverKey.length === 0)
		return [];

	const head = serverKey[0];
	// The server publishes two-element per-title keys — ["movie","<id>"] and
	// ["tv","<id>"] — so the id sits at index 1, not 2. Reading index 2 left it
	// undefined and silently dropped every per-title invalidation.
	const id = serverKey[1];

	// QueryClient.kt:667-699: the server's 'base' prefix is dropped.
	if (head === 'base' && serverKey.length > 1)
		return [serverKey.slice(1)];
	if (head === 'movie' && id !== undefined)
		return [['info', 'movie', id]];
	if (head === 'tv' && id !== undefined)
		return [['info', 'tv', id], ['playlist', 'tv', id]];
	return [serverKey];
}

export function invalidateFromServer(serverKey: readonly string[]): void {
	const client = getClient?.();
	if (!client)
		return;
	for (const clientKey of mapServerKey(serverKey)) {
		void client.invalidateQueries({ queryKey: [...clientKey], exact: false });
	}
}

export function invalidateAllLibrary(): void {
	const client = getClient?.();
	if (!client)
		return;
	for (const prefix of [
		'home',
		'libraries',
		'library',
		'info',
		'playlist',
		'card-items',
		'music',
		'search',
		'person',
		'component',
	]) {
		void client.invalidateQueries({ queryKey: [prefix], exact: false });
	}
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
	if (!client)
		return;
	void client.invalidateQueries({ queryKey: ['plugins'], exact: false });
}

/** NoMercyApplication.kt:760-787: a foreground after 10 s away refreshes the library; every foreground sweeps. */
export const ForegroundThresholdMs = 10_000;

export function createForegroundWatch(refresh: () => void, sweep: () => void, now: () => number = Date.now): { hidden: () => void; visible: () => void } {
	let hiddenAt: number | null = null;
	return {
		hidden: () => {
			hiddenAt = now();
		},
		visible: () => {
			if (hiddenAt !== null && now() - hiddenAt >= ForegroundThresholdMs)
				refresh();
			hiddenAt = null;
			sweep();
		},
	};
}

/** WatchScreen.kt:705-716: leaving the player refreshes home and libraries, exact, only when something played. */
export function invalidateAfterPlayback(played: boolean): void {
	const client = getClient?.();
	if (!client || !played)
		return;
	void client.invalidateQueries({ queryKey: ['home'], exact: true });
	void client.invalidateQueries({ queryKey: ['libraries'], exact: true });
}

export function staleSweep(maxAgeMs = 3 * 60 * 60_000): void {
	const client = getClient?.();
	if (!client)
		return;
	const cutoff = Date.now() - maxAgeMs;
	const queries = client.getQueryCache().getAll();
	for (const q of queries) {
		if (q.state.dataUpdatedAt > 0 && q.state.dataUpdatedAt < cutoff) {
			void client.invalidateQueries({ queryKey: q.queryKey, exact: true });
		}
	}
}
