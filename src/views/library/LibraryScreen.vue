<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useLibraryQuery } from '@/queries/useLibraryQuery';
import HeroRailsView from '@/views/HeroRailsView.vue';

/*
 * Library drilldown view — used for /libraries/:id, /genres/:id,
 * /collection, /specials. Same hero + rails composition as
 * TvLibraryScreen.kt.
 */

const LEADING_SLASH = /^\//;
const { t } = useTranslation();
const route = useRoute();
const path = computed(() => route.fullPath.replace(LEADING_SLASH, '').split('?')[0] ?? '');

const { data, isLoading, error, refetch, isFetching } = useLibraryQuery(path);
</script>

<template>
	<HeroRailsView
		restoration-key="library-rails"
		:data="data"
		:is-loading="isLoading"
		:is-fetching="isFetching"
		:error="error"
		:refetch="() => refetch()"
		:error-context="t('views.library.load_error')"
		:empty-message="t('views.library.empty')"
	/>
</template>
