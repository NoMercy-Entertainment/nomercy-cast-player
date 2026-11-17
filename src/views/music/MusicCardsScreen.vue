<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useMusicCardQuery } from '@/queries/useMusicCardQuery';
import HeroRailsView from '@/views/HeroRailsView.vue';

const { t } = useTranslation();
const route = useRoute();
const path = computed(() => {
	const matched = route.params.pathMatch;

	if (Array.isArray(matched))
		return matched.join('/');

	return matched ?? '';
});

const { data, isLoading, isFetching, error, refetch } = useMusicCardQuery(path);
</script>

<template>
	<HeroRailsView
		:restoration-key="`music-cards-${path}`"
		:data="data"
		:is-loading="isLoading"
		:is-fetching="isFetching"
		:error="error"
		:refetch="() => refetch()"
		:error-context="t('views.music.cards_error')"
		:empty-message="t('views.music.cards_empty')"
		:skeleton-count="2"
		:hero="false"
	/>
</template>
