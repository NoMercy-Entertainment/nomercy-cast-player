<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PluginMediaRef } from '@/lib/plugin/mediaRef';
import type { Update } from './types';
import { playPluginMedia } from '@/lib/plugin/playIntent';
import { musicSyncBridge } from '@/players/music/syncBridge';
import { videoSyncBridge } from '@/players/video/syncBridge';
import { useFocusEntry } from '@/composables/useFocusEntry';

const props = defineProps<{
	id: string;
	data: PluginMediaRef;
	update?: Update;
}>();

const el = ref<HTMLElement | null>(null);

const label = computed<string>(() =>
	(props.data.artist ? `${props.data.title} - ${props.data.artist}` : props.data.title));

useFocusEntry({
	key: props.id,
	el,
	onAction: () => {
		playPluginMedia(props.data, {
			music: () => musicSyncBridge.current(),
			video: () => videoSyncBridge.current(),
		});
	},
});
</script>

<template>
	<article
		ref="el"
		class="plugin-media-card"
		:aria-label="label"
		data-focusable
		tabindex="0"
		role="button"
	>
		<img v-if="props.data.cover" :src="props.data.cover" :alt="props.data.title" class="cover">
		<div class="meta">
			<p class="name">
				{{ props.data.title }}
			</p>
			<p v-if="props.data.artist" class="artist">
				{{ props.data.artist }}
			</p>
		</div>
	</article>
</template>

<style scoped>
.plugin-media-card {
	display: grid;
	grid-template-columns: 64px 1fr;
	align-items: center;
	gap: 16px;
	padding: 8px 16px;
	border: 2px solid transparent;
	background: transparent;
	cursor: pointer;
	border-radius: 8px;
	outline: none;
	text-align: start;
	width: 100%;
	transition:
		background var(--motion-fast),
		border-color var(--motion-fast);
}
.plugin-media-card:focus-visible {
	background: rgba(255, 255, 255, 0.06);
	border-color: var(--color-primary, oklch(0.7 0.2 285));
}
.cover {
	width: 48px;
	height: 48px;
	border-radius: 8px;
	object-fit: cover;
}
.name {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
}
.artist {
	margin: 2px 0 0;
	font-size: 14px;
	color: var(--color-text-secondary);
}
</style>
