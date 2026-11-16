import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { installChunkReload, isChunkLoadError } from './chunkReload';

// A deploy removes the old chunks; a receiver page opened before it must reload, not stay dead.
const staleChunk = new TypeError('Failed to fetch dynamically imported module: https://cast.example/assets/LibraryScreen-old.js');

function storage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
	const values = new Map<string, string>();
	return {
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => { values.set(key, value); },
		removeItem: (key) => { values.delete(key); },
	};
}

function routerWithStaleChunk() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/', component: { template: '<div />' } },
			{ path: '/libraries/:id', component: () => Promise.reject(staleChunk) },
		],
	});
}

describe('chunk-load failure', () => {
	it('knows a missing chunk from another error', () => {
		expect(isChunkLoadError(staleChunk)).toBe(true);
		expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
		expect(isChunkLoadError(new TypeError('x is undefined'))).toBe(false);
	});

	it('reloads the page at the route the viewer opened', async () => {
		const router = routerWithStaleChunk();
		const reload = vi.fn();
		installChunkReload(router, { reload, storage: storage() });
		await router.push('/');

		await router.push('/libraries/7').catch(() => {});

		expect(reload).toHaveBeenCalledWith('/libraries/7');
	});

	it('reloads only once for the same route, so a real outage cannot loop', async () => {
		const router = routerWithStaleChunk();
		const reload = vi.fn();
		const store = storage();
		installChunkReload(router, { reload, storage: store });
		await router.push('/');

		await router.push('/libraries/7').catch(() => {});
		// The reloaded page meets the same missing chunk.
		const again = routerWithStaleChunk();
		installChunkReload(again, { reload, storage: store });
		await again.push('/libraries/7').catch(() => {});

		expect(reload).toHaveBeenCalledTimes(1);
	});
});
