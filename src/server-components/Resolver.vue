<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import type { Component } from './types';
import Skeleton from '@/components/feedback/Skeleton.vue';
import UnknownComponent from './UnknownComponent.vue';

defineProps<{
	component: Component;
}>();

/**
 * Lazy registry per spec §11.2. Each renderer chunk fetches on first use,
 * then caches. main.ts pre-warms the most common renderers via idle
 * callback so first-render chunk-fetch doesn't stall the home view.
 */
const registry = {
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
	NMCarousel: defineAsyncComponent({
		loader: () => import('./NMCarousel.vue'),
		loadingComponent: Skeleton,
		delay: 0,
		timeout: 8000,
	}),
	NMCard: defineAsyncComponent(() => import('./NMCard.vue')),
	NMHomeCard: defineAsyncComponent(() => import('./NMHomeCard.vue')),
	NMMusicCard: defineAsyncComponent(() => import('./NMMusicCard.vue')),
	NMMusicHomeCard: defineAsyncComponent(() => import('./NMMusicHomeCard.vue')),
	NMGenreCard: defineAsyncComponent(() => import('./NMGenreCard.vue')),
	NMTopResultCard: defineAsyncComponent(() => import('./NMTopResultCard.vue')),
	NMTrackRow: defineAsyncComponent(() => import('./NMTrackRow.vue')),
	NMHero: defineAsyncComponent(() => import('./NMHero.vue')),
	NMHeroCard: defineAsyncComponent(() => import('./NMHeroCard.vue')),
} as const;

type RegistryKey = keyof typeof registry;
</script>

<script lang="ts">
// Card-shaped server payloads wrap their wrapper under props.data:
//   { id, title, data: { id, title, poster, backdrop, link, ... }, watch }
// Container shapes (carousels, grids, lists) keep the wrapper flat under
// props directly. Normalise by passing props.data when it's an object —
// otherwise the flat props itself.

function normaliseData(props: unknown): any {
	if (
		props
		&& typeof props === 'object'
		&& 'data' in props
		&& (props as { data: unknown }).data
		&& typeof (props as { data: unknown }).data === 'object'
		&& !Array.isArray((props as { data: unknown }).data)
	) {
		return (props as { data: unknown }).data;
	}
	return props;
}
</script>

<template>
	<component
		:is="registry[component.component as RegistryKey]"
		v-if="(component.component as RegistryKey) in registry"
		:id="component.id"
		:data="normaliseData(component.props)"
		:update="component.update"
	/>
	<UnknownComponent v-else :id="component.id" :type="component.component" />
</template>
