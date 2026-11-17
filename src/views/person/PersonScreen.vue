<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { usePersonQuery } from '@/queries/usePersonQuery';
import { applyThemeColor, clearThemeColor } from '@/lib/theme';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { FocusedCardData } from '@/stores/focusedCardStore';
import HeroRailsView from '@/views/HeroRailsView.vue';

/*
 * PersonScreen.kt: the server's NMHomeCard is a fixed hero that never follows focus;
 * the shared renderer draws the NMLolomo of credit rows below it.
 */
const route = useRoute();
const { t } = useTranslation();
const id = computed(() => String(route.params.id ?? ''));
const { data, isLoading, error, refetch, isFetching } = usePersonQuery(id);

const heroComponent = computed(() => data.value?.find((c) => c.component === 'NMHomeCard'));
// tv/PersonScreen.kt:156 draws only the backdrop, never the profile photo.
const hero = computed(() => {
	const card = (heroComponent.value?.props as { data?: FocusedCardData } | undefined)?.data;

	return card
		? { ...card, poster: undefined } as const satisfies FocusedCardData
		: undefined;
});
const rows = computed(() => data.value?.filter((c) => c !== heroComponent.value));

// PersonScreen.kt:56-60: the page color is the known-for backdrop palette.
watch(hero, (next) => applyThemeColor(next?.color_palette?.backdrop ?? null), { immediate: true });
focusedCardStore.setThemeFollowsFocus(false);

onBeforeUnmount(() => {
	focusedCardStore.setThemeFollowsFocus(true);
	clearThemeColor();
});
</script>

<template>
	<HeroRailsView
		:restoration-key="`person-${id}-rails`"
		:data="rows"
		:is-loading="isLoading"
		:is-fetching="isFetching"
		:error="error"
		:refetch="() => refetch()"
		:error-context="t('views.person.load_error')"
		:empty-message="t('views.person.empty')"
		:hero="false"
		:persistent-hero="hero"
	/>
</template>
