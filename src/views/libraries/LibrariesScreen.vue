<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { useLibrariesQuery } from '@/queries/useLibrariesQuery';
import HeroRailsView from '@/views/HeroRailsView.vue';

/* Libraries view — same hero + rails composition as TvHomeScreen. */

const { t } = useTranslation();
const { data, isLoading, error, refetch, isFetching } = useLibrariesQuery();
</script>

<template>
	<HeroRailsView
		restoration-key="libraries-rails"
		:data="data"
		:is-loading="isLoading"
		:is-fetching="isFetching"
		:error="error"
		:refetch="() => refetch()"
		:error-context="t('views.libraries.load_error')"
		:empty-message="t('views.libraries.empty')"
	/>
</template>
