/**
 * Query keys ported verbatim from android QueryClient.kt per spec §6.1.
 * Any drift here breaks parity with web/android invalidation.
 */

const LEADING_SLASH = /^\//;

export const QueryKeys = {
	home: () => ['home'] as const,
	library: (path: string) =>
		['library', ...path.replace(LEADING_SLASH, '').split('/')] as readonly string[],
	libraries: () => ['libraries'] as const,
	cardItems: (link: string) => ['card-items', link] as const,
	info: (type: string, id: string) => ['info', type, id] as const,
	available: (type: string, id: string) => ['info', type, id, 'available'] as const,
	person: (id: string) => ['person', id] as const,
	search: (type: string, query: string) => ['search', type, query] as const,
	musicStart: () => ['music', 'start'] as const,
	musicCards: (path: string) =>
		['music', ...path.replace(LEADING_SLASH, '').split('/')] as readonly string[],
	musicLists: (type: string, id: string) => ['music', type, id] as const,
	component: (link: string) => ['component', link] as const,
	playlist: (type: string, id: string) => ['playlist', type, id] as const,
	trailer: (candidates: readonly string[]) => ['trailer', ...candidates] as readonly string[],
} as const;

export type QueryKey = readonly unknown[];
