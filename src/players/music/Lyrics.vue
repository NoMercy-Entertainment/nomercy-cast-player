<script setup lang="ts">
import { useTranslation } from 'i18next-vue';

const { t } = useTranslation();

/**
 * Lyrics — v1 stub per spec §12.13. v2 adds synced scrolling.
 * Receiver shows "Lyrics coming soon" placeholder when track has lyrics
 * available and the user explicitly opens the lyrics panel.
 */
</script>

<template>
	<section class="lyrics-stub">
		<p>{{ t('music.player.lyrics_coming_soon') }}</p>
	</section>
</template>

<style scoped>
.lyrics-stub {
	padding: 32px;
	text-align: center;
	color: var(--color-text-secondary);
	font-size: 18px;
}
</style>
