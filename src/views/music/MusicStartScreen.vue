<script setup lang="ts">
import { useMusicStartQuery } from '@/queries/useMusicStartQuery';
import PluginSlot from '@/server-components/PluginSlot.vue';
import HeroRailsView from '@/views/HeroRailsView.vue';

/* Music start view — same hero + rails composition as TvHomeScreen. */

const { data, isLoading, error, refetch, isFetching } = useMusicStartQuery();
</script>

<template>
	<HeroRailsView
		restoration-key="music-start-rails"
		:data="data"
		:is-loading="isLoading"
		:is-fetching="isFetching"
		:error="error"
		:refetch="() => refetch()"
		error-context="Couldn't load music"
		empty-message="No music yet. Add a music library to get started."
		:skeleton-count="2"
	>
		<template #rails-end>
			<PluginSlot kind="music" slot-name="home-row" />
		</template>
	</HeroRailsView>
</template>
