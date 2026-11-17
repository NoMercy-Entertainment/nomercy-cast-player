<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { useFavoritesQuery } from '@/queries/useFavoritesQuery';
import HeroRailsView from '@/views/HeroRailsView.vue';

// FavoritesScreen.kt: userData/favorites is a flat grid of cards, no hero.
const { t } = useTranslation();
const { data, isLoading, error, refetch, isFetching } = useFavoritesQuery();
</script>

<template>
	<HeroRailsView
		restoration-key="favorites-grid"
		:data="data"
		:is-loading="isLoading"
		:is-fetching="isFetching"
		:error="error"
		:refetch="() => refetch()"
		:error-context="t('views.favorites.load_error')"
		:empty-message="t('views.favorites.empty')"
		:hero="false"
	/>
</template>
