<script setup lang="ts">
import { useHomeQuery } from '@/queries/useHomeQuery';
import HeroRailsView from '@/views/HeroRailsView.vue';
import PluginSlot from '@/server-components/PluginSlot.vue';

/*
 * Home view — APK TvHomeScreen.kt parity. The shared HeroRailsView
 * scaffold owns focus group + nav bridge + hero seeding + auto-retry +
 * loading / error / empty branches; this screen just supplies the
 * useHomeQuery result and per-screen copy.
 */

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
		error-context="Couldn't load home"
		empty-message="Your home is empty. Add a library on your phone or desktop to get started."
		:skeleton-count="4"
	>
		<template #rails-end>
			<PluginSlot kind="video" slot-name="home-row" />
			<PluginSlot kind="library" slot-name="home-row" />
		</template>
	</HeroRailsView>
</template>
