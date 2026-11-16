<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { useHomeQuery } from '@/queries/useHomeQuery';
import HeroRailsView from '@/views/HeroRailsView.vue';
import PluginSlot from '@/server-components/PluginSlot.vue';

/*
 * Home view — APK TvHomeScreen.kt parity. The shared HeroRailsView
 * scaffold owns focus group + nav bridge + hero seeding + auto-retry +
 * loading / error / empty branches; this screen just supplies the
 * useHomeQuery result and per-screen copy.
 */

const { t } = useTranslation();
const { data, isLoading, error, refetch, isFetching } = useHomeQuery();
</script>

<template>
	<HeroRailsView
		restoration-key="home-rails"
		:data="data"
		:is-loading="isLoading"
		:is-fetching="isFetching"
		:error="error"
		:refetch="() => refetch()"
		:error-context="t('views.home.load_error')"
		:empty-message="t('views.home.empty')"
		:skeleton-count="4"
	>
		<template #rails-end>
			<PluginSlot kind="video" slot-name="home-row" />
			<PluginSlot kind="library" slot-name="home-row" />
		</template>
	</HeroRailsView>
</template>
