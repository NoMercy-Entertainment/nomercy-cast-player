<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { playbackStore } from '@/stores/playbackStore';

const { t } = useTranslation();

const queue = playbackStore.music.queue;
const upNext = computed(() => queue.value.slice(0, 3));
</script>

<template>
	<aside v-if="upNext.length" class="queue-peek">
		<h3>{{ t('music.player.up_next') }}</h3>
		<ol>
			<li v-for="(track, i) in upNext" :key="track.id">
				<span class="pos">{{ i + 1 }}</span>
				<span class="name">{{ track.name }}</span>
				<span v-if="track.artist" class="artist">{{ track.artist }}</span>
			</li>
		</ol>
	</aside>
</template>

<style scoped>
.queue-peek {
	background: oklch(0.18 0.01 250 / 0.85);
	border-radius: 16px;
	padding: 16px 24px;
	width: 360px;
}
h3 {
	margin: 0 0 12px;
	font-size: 14px;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
}
ol {
	margin: 0;
	padding: 0;
	list-style: none;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
li {
	display: grid;
	grid-template-columns: 24px 1fr auto;
	align-items: center;
	gap: 12px;
	font-size: 14px;
}
.pos {
	color: var(--color-text-secondary);
	font-variant-numeric: tabular-nums;
}
.name {
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.artist {
	color: var(--color-text-secondary);
}
</style>
