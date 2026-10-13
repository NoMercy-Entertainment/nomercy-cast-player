import { onActivated, onMounted, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { getQueryClient } from './client';
import { apiFetch } from '@/lib/http/client';
import {
	CONTAINER_TYPES,

} from '@/server-components/types';
import type { Component, ContainerWrapper } from '@/server-components/types';
import type { QueryKey } from './keys';

/**
 * pageLoad section refresh per spec §11.8-§11.13.
 *
 * Server-driven components can carry `update.when === 'pageLoad'` to opt
 * into per-revisit refresh. On page revisit (not on fresh load), we walk
 * the cached component tree, fetch each pageLoad component's
 * update.link in parallel, and replace those components in-place via
 * setQueryData. Parent query never invalidates — only the specific cards
 * refresh.
 *
 * Mirrors android's usePageLoadMutationEffect + handleComponentMutationBatch
 * 1:1.
 */

interface PageLoadCandidate {
	component: Component;
	path: string[];
}

export function collectPageLoadComponents(components: Component[]): PageLoadCandidate[] {
	const result: PageLoadCandidate[] = [];

	function traverse(items: Component[], path: string[] = []): void {
		for (const c of items) {
			if (c.update?.when === 'pageLoad') {
				result.push({ component: c, path });
			}
			if (CONTAINER_TYPES.has(c.component)) {
				const childItems = (c.props as ContainerWrapper).items;
				if (Array.isArray(childItems)) {
					traverse(childItems, [...path, c.id]);
				}
			}
		}
	}

	traverse(components);
	return result;
}

function updateNested(
	components: Component[],
	path: string[],
	replaceId: string,
	replacement: Component,
): Component[] {
	if (path.length === 0) {
		return components.map(c => (c.id === replaceId ? replacement : c));
	}
	const [parentId, ...rest] = path;
	return components.map((c) => {
		if (c.id !== parentId)
			return c;
		const wrapper = c.props as ContainerWrapper;
		if (!Array.isArray(wrapper.items))
			return c;
		return {
			...c,
			props: {
				...wrapper,
				items: updateNested(wrapper.items, rest, replaceId, replacement),
			},
		};
	});
}

async function fetchSingleByLink(link: string, replaceId: string): Promise<Component | null> {
	try {
		const response = await apiFetch<Component[] | Component | { components: Component[] }>({
			path: link.startsWith('/') ? link : `/${link}`,
			method: 'GET',
		});
		// Server may return the component directly, or wrapped in { components },
		// or in an array we need to find by id.
		if (Array.isArray(response)) {
			return response.find(c => c.id === replaceId) ?? response[0] ?? null;
		}
		if (
			response
			&& typeof response === 'object'
			&& 'components' in (response as Record<string, unknown>)
		) {
			const list = (response as { components: Component[] }).components;
			return list.find(c => c.id === replaceId) ?? list[0] ?? null;
		}
		return response as Component;
	}
	catch (err) {
		console.warn(`[pageLoad] fetch failed for ${link}`, err);
		return null;
	}
}

export async function handleComponentMutationBatch(
	candidates: PageLoadCandidate[],
	queryKey: MaybeRefOrGetter<QueryKey>,
): Promise<void> {
	if (candidates.length === 0)
		return;

	const replacements = await Promise.all(
		candidates.map(async ({ component, path }) => {
			const update = component.update;
			if (!update?.link)
				return null;

			const replaceId
				= update.body?.replace_id ?? update.body?.replaceId ?? component.id;

			const replacement = await fetchSingleByLink(update.link, replaceId);
			if (!replacement)
				return null;
			return { replaceId, replacement, path };
		}),
	);

	const queryClient = getQueryClient();
	queryClient.setQueryData<Component[]>([...toValue(queryKey)], (current) => {
		if (!current)
			return current;
		let next = current;
		for (const r of replacements) {
			if (!r)
				continue;
			next = updateNested(next, r.path, r.replaceId, r.replacement);
		}
		return next;
	});
}

/**
 * Composable wired into every server-driven query hook (useHomeQuery,
 * useLibraryQuery, etc). Tracks fresh-load vs revisit via an activation
 * counter + isLoading watcher; only fires the batch on revisit.
 */
export function usePageLoadMutationEffect(
	queryKey: MaybeRefOrGetter<QueryKey>,
	data: Ref<Component[] | undefined>,
	isLoading: Ref<boolean>,
	isFetching: Ref<boolean>,
): void {
	const hasSeenLoading = ref(false);
	const firedForActivation = ref(-1);
	const activationCounter = ref(0);

	onActivated(() => activationCounter.value++);
	onMounted(() => activationCounter.value++);

	watch([isLoading, isFetching], ([l, f]) => {
		if (l || f)
			hasSeenLoading.value = true;
	});

	watch(
		[data, activationCounter],
		async ([d, c]) => {
			if (!d)
				return;
			if (firedForActivation.value === c)
				return;
			firedForActivation.value = c;

			const isFreshLoad = hasSeenLoading.value;
			hasSeenLoading.value = false;
			if (isFreshLoad)
				return;

			const candidates = collectPageLoadComponents(d);
			if (candidates.length > 0) {
				await handleComponentMutationBatch(candidates, queryKey);
			}
		},
	);
}
