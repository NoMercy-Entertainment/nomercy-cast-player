<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { focusTopnav, useNavFocusBridge } from '@/composables/useNavFocusBridge';
import { useAutoRetry } from '@/composables/useAutoRetry';
import { useHeroSeed } from '@/composables/useHeroSeed';
import Resolver from '@/server-components/Resolver.vue';
import Skeleton from '@/components/feedback/Skeleton.vue';
import EmptyState from '@/components/feedback/EmptyState.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import HomeHero from '@/views/home/HomeHero.vue';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { Component } from '@/server-components/types';

/*
 * Shared hero + rails scaffold used by Home / Libraries / Library /
 * MusicStart. Mirrors APK TvHomeScreen.kt — fixed hero region pinned
 * to the top, rails laid below it. Owns focus group + nav bridge,
 * hero seeding, auto-retry, and error / loading / empty branches.
 *
 * Vue auto-unwraps refs at template prop boundaries, so we type the
 * props as already-unwrapped values and the parent passes its
 * useQuery() refs directly.
 */

const props = defineProps<{
	restorationKey: string;
	data: Component[] | undefined;
	isLoading: boolean;
	isFetching?: boolean;
	error?: unknown;
	refetch: () => void;
	errorContext: string;
	emptyMessage: string;
	skeletonCount?: number;
}>();

const containerEl = ref<HTMLElement | null>(null);
const railsGroup = useFocusGroup({
	type: 'vertical',
	restorationKey: props.restorationKey,
	containerEl,
	onEscape: dir => (dir === 'up' ? focusTopnav() : false),
});
useNavFocusBridge({ handle: railsGroup, containerEl });

const components = computed<Component[]>(() => props.data ?? []);
const isInitialLoad = computed(() => props.isLoading && !props.data);
const errVal = computed(() => (props.error as Error | null) ?? null);
const heroCard = computed(() => focusedCardStore.debouncedCard.value);
const skeletonRailCount = computed(() => props.skeletonCount ?? 3);

const errorRef = toRef(props, 'error');
useAutoRetry({ error: errorRef, refetch: () => props.refetch() });

// useHeroSeed expects a ref of components; wrap props.data in a watch
// that funnels into a ref so it picks up reactivity.
const componentsRef = ref<Component[]>([]);
watch(components, (next) => {
	componentsRef.value = next;
}, { immediate: true });
useHeroSeed(componentsRef);
</script>

<template>
	<div ref="containerEl" class="nm-hero-rails-screen">
		<ErrorPanel
			v-if="errVal"
			:error="errVal"
			:retry="refetch"
			:context="errorContext"
		/>
		<template v-else-if="isInitialLoad">
			<Skeleton
				v-for="n in skeletonRailCount"
				:key="n"
				type="rail"
				:count="6"
			/>
		</template>
		<EmptyState
			v-else-if="components.length === 0"
			:message="emptyMessage"
			:action="{ label: 'Refresh', onAction: refetch }"
		/>
		<template v-else>
			<HomeHero v-if="heroCard" :card="heroCard" />
			<div class="nm-hero-rails">
				<Resolver
					v-for="component in components"
					:key="component.id"
					:component="component"
				/>
				<!--
					Inside the rails, so whatever a screen puts here is one more
					row the remote reaches by pressing down, not a region the
					focus group cannot see.
				-->
				<slot name="rails-end" />
			</div>
			<p v-if="isFetching" class="nm-refresh-hint">
				Refreshing…
			</p>
		</template>
	</div>
</template>
