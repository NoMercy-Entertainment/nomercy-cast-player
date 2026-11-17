<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
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
import type { FocusedCardData } from '@/stores/focusedCardStore';
import { drawsContent } from '@/server-components/types';
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

const props = withDefaults(defineProps<{
	restorationKey: string;
	data: Component[] | undefined;
	isLoading: boolean;
	isFetching?: boolean;
	error?: Error | null;
	refetch: () => void;
	errorContext: string;
	emptyMessage: string;
	skeletonCount?: number;
	// A page without hero art (Music) says so; it then seeds no hero and keeps no hero room.
	hero?: boolean;
	// Music rows are Compose carousels in KMP: their title and gap differ from the video rows.
	music?: boolean;
	// A page about one subject (Person) keeps this hero whatever has focus; its rows start flush below it.
	persistentHero?: FocusedCardData;
}>(), {
	hero: true,
	music: false,
	persistentHero: undefined,
});

const { t } = useTranslation();

const containerEl = ref<HTMLElement | null>(null);
const railsGroup = useFocusGroup({
	type: 'vertical',
	restorationKey: props.restorationKey,
	containerEl,
	takeFocusFrom: '.topnav',
	onEscape: (dir) =>
		dir === 'up'
			? focusTopnav()
			: false,
});

useNavFocusBridge({ handle: railsGroup, containerEl });

// The TV page is the lolomo alone: a top-level NMHomeCard is dropped (HasContent.kt:38-48).
const components = computed<Component[]>(() =>
	(props.data ?? []).filter((c) => props.music || c.component !== 'NMHomeCard'),
);
const isInitialLoad = computed(() => props.isLoading && !props.data);
const errVal = computed(() => props.error ?? null);

function hasCarousel(list: Component[]): boolean {
	return list.some((c) => {
		if (c.component === 'NMCarousel')
			return true;

		const items = (c.props as { items?: Component[] }).items;

		return Array.isArray(items) && hasCarousel(items);
	});
}

// NMLolomo.kt:74-75: showHero = hasCarousels && hero != "none".
const showHero = computed(() =>
	props.hero &&
	hasCarousel(components.value) &&
	!components.value.some((c) => c.component === 'NMLolomo' && (c.props as { hero?: string }).hero === 'none'),
);
const heroCard = computed(() => {
	if (props.persistentHero)
		return props.persistentHero;

	return showHero.value
		? focusedCardStore.debouncedCard.value
		: null;
});

// NMLolomo.kt:83-92: the error page needs no data and a 900 ms settle; rows already drawn stay.
const FAILURE_SETTLE_MS = 900;
const hasFailed = computed(() => Boolean(errVal.value) && !props.data?.length && !props.isLoading);
const showFailure = ref(false);
let settleTimer: number | null = null;

watch(hasFailed, (failed) => {
	if (settleTimer !== null) {
		window.clearTimeout(settleTimer);
		settleTimer = null;
	}

	if (!failed) {
		showFailure.value = false;

		return;
	}

	settleTimer = window.setTimeout(() => {
		showFailure.value = true;
		settleTimer = null;
	}, FAILURE_SETTLE_MS);
}, { immediate: true });

onBeforeUnmount(() => {
	if (settleTimer !== null) {
		window.clearTimeout(settleTimer);
	}
});

const skeletonRailCount = computed(() => props.skeletonCount ?? 3);

const errorRef = toRef(props, 'error');

useAutoRetry({ error: errorRef, refetch: () => props.refetch() });

// useHeroSeed expects a ref of components; wrap props.data in a watch
// that funnels into a ref so it picks up reactivity.
const componentsRef = ref<Component[]>([]);

watch(components, (next) => {
	componentsRef.value = next;
}, { immediate: true });

if (props.hero) {
	useHeroSeed(componentsRef);
}
</script>

<template>
	<div ref="containerEl" class="nm-hero-rails-screen">
		<ErrorPanel
			v-if="showFailure && errVal"
			:error="errVal"
			:retry="refetch"
			:context="errorContext"
		/>
		<template v-else-if="isInitialLoad || hasFailed">
			<div v-if="hero" class="nm-hero-room" aria-hidden="true" />
			<div class="nm-hero-rails" :class="{ 'nm-hero-rails--no-hero': !hero }">
				<Skeleton
					v-for="n in skeletonRailCount"
					:key="n"
					type="rail"
					titled
					:count="6"
				/>
			</div>
		</template>
		<EmptyState
			v-else-if="!components.some(drawsContent)"
			:message="emptyMessage"
			:action="{ label: t('common.refresh'), onAction: refetch }"
		/>
		<template v-else>
			<HomeHero v-if="heroCard" :card="heroCard" />
			<div
				class="nm-hero-rails"
				:class="{
					'nm-hero-rails--no-hero': !heroCard,
					'nm-hero-rails--music': music,
					'nm-hero-rails--flush': Boolean(persistentHero),
				}"
			>
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
				{{ t('views.refreshing') }}
			</p>
		</template>
	</div>
</template>
