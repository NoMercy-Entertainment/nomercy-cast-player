import { defineAsyncComponent } from 'vue';
import Skeleton from '@/components/feedback/Skeleton.vue';

/**
 * Lazy registry per spec §11.2. Each renderer chunk fetches on first use,
 * then caches. main.ts pre-warms the most common renderers via idle
 * callback so first-render chunk-fetch doesn't stall the home view.
 */
export const registry = {
	NMGrid: defineAsyncComponent({
		loader: () => import('./NMGrid.vue'),
		loadingComponent: Skeleton,
		delay: 0,
		timeout: 8000,
	}),
	NMList: defineAsyncComponent({
		loader: () => import('./NMList.vue'),
		loadingComponent: Skeleton,
		delay: 0,
		timeout: 8000,
	}),
	NMContainer: defineAsyncComponent({
		loader: () => import('./NMContainer.vue'),
		loadingComponent: Skeleton,
		delay: 0,
		timeout: 8000,
	}),
	NMLolomo: defineAsyncComponent({
		loader: () => import('./NMLolomo.vue'),
		loadingComponent: Skeleton,
		delay: 0,
		timeout: 8000,
	}),
	NMCarousel: defineAsyncComponent({
		loader: () => import('./NMCarousel.vue'),
		loadingComponent: Skeleton,
		delay: 0,
		timeout: 8000,
	}),
	NMText: defineAsyncComponent(() => import('./NMText.vue')),
	NMCard: defineAsyncComponent(() => import('./NMCard.vue')),
	NMHomeCard: defineAsyncComponent(() => import('./NMHomeCard.vue')),
	NMMusicCard: defineAsyncComponent(() => import('./NMMusicCard.vue')),
	NMMusicHomeCard: defineAsyncComponent(() => import('./NMMusicHomeCard.vue')),
	NMGenreCard: defineAsyncComponent(() => import('./NMGenreCard.vue')),
	NMGroupCard: defineAsyncComponent(() => import('./NMGroupCard.vue')),
	NMTopResultCard: defineAsyncComponent(() => import('./NMTopResultCard.vue')),
	NMTrackRow: defineAsyncComponent(() => import('./NMTrackRow.vue')),
	NMHero: defineAsyncComponent(() => import('./NMHero.vue')),
	NMHeroCard: defineAsyncComponent(() => import('./NMHeroCard.vue')),
	// Host plumbing, not a component a plugin may ask for: it marks the place
	// where whatever plugins were placed in this area draws, and what draws
	// there is the server's own vocabulary all the way down.
	PluginSlot: defineAsyncComponent(() => import('./PluginSlot.vue')),
} as const;

export type RegistryKey = keyof typeof registry;

/** True when the Resolver has a renderer for this type. */
export function canDraw(type: string): type is RegistryKey {
	return type in registry;
}
