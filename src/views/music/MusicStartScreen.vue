<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { useMusicStartQuery } from '@/queries/useMusicStartQuery';
import PluginSlot from '@/server-components/PluginSlot.vue';
import HeroRailsView from '@/views/HeroRailsView.vue';

/* Music start view — same hero + rails composition as TvHomeScreen. */

const { t } = useTranslation();
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
		:error-context="t('views.music.start_error_load')"
		:empty-message="t('views.music.start_empty')"
		:skeleton-count="2"
		music
	>
		<template #rails-end>
			<PluginSlot kind="music" slot-name="home-row" />
		</template>
	</HeroRailsView>
</template>
