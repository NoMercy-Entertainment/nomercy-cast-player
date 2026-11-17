<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { usePersonQuery } from '@/queries/usePersonQuery';
import { applyThemeColor, clearThemeColor } from '@/lib/theme';
import { focusedCardStore } from '@/stores/focusedCardStore';
import { settingsStore } from '@/stores/settingsStore';
import type { FocusedCardData } from '@/stores/focusedCardStore';
import HeroRailsView from '@/views/HeroRailsView.vue';
import { buildPersonRows, personHeroBackdrop } from './personRows';

/*
 * PersonScreen.kt: the server's NMHomeCard is a fixed hero that never follows focus;
 * the shared renderer draws the NMLolomo of credit rows below it.
 */
const route = useRoute();
const { t } = useTranslation();
const id = computed(() => String(route.params.id ?? ''));
const { data, isLoading, error, refetch, isFetching } = usePersonQuery(id);

const components = computed(() => (data.value?.kind === 'components' ? data.value.components : undefined));
const legacy = computed(() => (data.value?.kind === 'legacy' ? data.value.person : undefined));
const knownFor = computed(() => (legacy.value ? personHeroBackdrop(legacy.value) : null));

const heroComponent = computed(() => components.value?.find((c) => c.component === 'NMHomeCard'));
// tv/PersonScreen.kt:156 draws only the backdrop, never the profile photo.
const hero = computed<FocusedCardData | undefined>(() => {
	if (legacy.value) {
		return {
			id: legacy.value.id,
			title: legacy.value.name,
			overview: legacy.value.biography,
			backdrop: knownFor.value?.backdrop ?? undefined,
			type: 'person',
		};
	}

	const card = (heroComponent.value?.props as { data?: FocusedCardData } | undefined)?.data;

	return card
		? { ...card, poster: undefined } as const satisfies FocusedCardData
		: undefined;
});
const rows = computed(() => {
	if (legacy.value) {
		return buildPersonRows(legacy.value, {
			knownFor: t('views.person.known_for'),
			acting: t('views.person.acting'),
			production: t('views.person.production'),
			writing: t('views.person.writing'),
			directing: t('views.person.directing'),
			crew: t('views.person.crew'),
			creator: t('views.person.creator'),
		});
	}

	return components.value?.filter((c) => c !== heroComponent.value);
});

// PersonScreen.kt:56-60: the page color is the known-for backdrop palette.
watch(
	[hero, knownFor, settingsStore.useAutoThemeColors],
	([next, credit, auto]) => applyThemeColor(auto
		? ((next?.color_palette ?? credit?.color_palette)?.backdrop ?? null)
		: null),
	{ immediate: true },
);
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
