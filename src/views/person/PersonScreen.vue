<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { usePersonQuery } from '@/queries/usePersonQuery';
import { applyThemeColor, clearThemeColor } from '@/lib/theme';
import { focusedCardStore } from '@/stores/focusedCardStore';
import HeroRailsView from '@/views/HeroRailsView.vue';
import { buildPersonRows, personHeroBackdrop } from './personRows';

/*
 * PersonScreen.kt: a persistent hero (name, biography, the best known-for backdrop)
 * above the credit rows. The hero never follows focus, and the rows start flush at 264.
 */
const route = useRoute();
const { t } = useTranslation();
const id = computed(() => String(route.params.id ?? ''));
const { data, isLoading, error, refetch, isFetching } = usePersonQuery(id);

const knownFor = computed(() => (data.value ? personHeroBackdrop(data.value) : null));
const hero = computed(() =>
	data.value
		? {
				id: data.value.id,
				title: data.value.name,
				overview: data.value.biography,
				backdrop: knownFor.value?.backdrop ?? undefined,
				type: 'person',
			}
		: undefined,
);
const rows = computed(() =>
	data.value
		? buildPersonRows(data.value, {
				knownFor: t('views.person.known_for'),
				acting: t('views.person.acting'),
				production: t('views.person.production'),
				writing: t('views.person.writing'),
				directing: t('views.person.directing'),
				crew: t('views.person.crew'),
				creator: t('views.person.creator'),
			})
		: undefined,
);

// PersonScreen.kt:56-60: the page color is the known-for backdrop palette.
watch(knownFor, (next) => applyThemeColor(next?.color_palette?.backdrop ?? null), { immediate: true });
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
