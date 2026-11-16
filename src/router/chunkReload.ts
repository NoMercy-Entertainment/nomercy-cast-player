import type { Router } from 'vue-router';

// Chrome: "Failed to fetch dynamically imported module"; Safari/Firefox word it differently.
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOADED_KEY = 'nm-chunk-reload';

export function isChunkLoadError(error: unknown): boolean {
	return error instanceof Error && CHUNK_ERROR.test(error.message);
}

interface ChunkReloadDeps {
	reload: (path: string) => void;
	storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

function browserDeps(): ChunkReloadDeps {
	return {
		reload: path => window.location.assign(path),
		storage: window.sessionStorage,
	};
}

/**
 * A deploy removes the chunks an open receiver page still points at. Reload once at the
 * route the viewer opened, so the new build loads; a second failure on that route is a real
 * outage and stays an error instead of a reload loop.
 */
export function installChunkReload(router: Router, deps: ChunkReloadDeps = browserDeps()): void {
	router.onError((error, to) => {
		if (!isChunkLoadError(error))
			return;
		if (deps.storage.getItem(RELOADED_KEY) === to.fullPath)
			return;
		deps.storage.setItem(RELOADED_KEY, to.fullPath);
		deps.reload(to.fullPath);
	});
	router.afterEach((to, _from, failure) => {
		if (!failure && deps.storage.getItem(RELOADED_KEY) === to.fullPath)
			deps.storage.removeItem(RELOADED_KEY);
	});
}
