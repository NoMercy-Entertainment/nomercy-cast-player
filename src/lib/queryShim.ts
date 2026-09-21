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

export function mapServerKey(serverKey: readonly string[]): readonly (readonly string[])[] {
	if (!Array.isArray(serverKey) || serverKey.length === 0)
		return [];

	const head = serverKey[0];
	const second = serverKey[1];
	// The server publishes two-element per-title keys — ["movie","<id>"] and
	// ["tv","<id>"] — so the id sits at index 1, not 2. Reading index 2 left it
	// undefined and silently dropped every per-title invalidation.
	const id = serverKey[1];

	if (head === 'base' && second === 'libraries')
		return [['libraries']];
	if (head === 'base' && second === 'info')
		return [['info']];
	if (head === 'movie' && id !== undefined)
		return [['info', 'movie', id]];
	if (head === 'tv' && id !== undefined)
		return [['info', 'tv', id]];
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
