<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';
import { buildImageUrl, SQUARE_SIZE } from '@/lib/images/urls';
import type { NMMusicHomeCardWrapper, Update } from './types';

const props = defineProps<{
	id: string;
	data: NMMusicHomeCardWrapper;
	update?: Update;
}>();

const router = useRouter();
const el = ref<HTMLElement | null>(null);
const cover = buildImageUrl(props.data.cover, SQUARE_SIZE);

useFocusEntry({
	key: props.id,
	el,
	onAction: () => {
		if (props.data.link)
			router.push(props.data.link);
	},
});
</script>

<template>
	<article ref="el" class="music-home-card nm-focus-scale-sm" data-focusable tabindex="0" role="button">
		<div class="cover nm-focus-ring">
			<img
				v-if="cover"
				class="nm-cover-top"
				:src="cover"
				:alt="props.data.name ?? ''"
				loading="lazy"
				decoding="async"
			>
			<FallbackPoster v-else :title="props.data.name" />
		</div>
		<div class="meta">
			<p v-if="props.data.type" class="kind">
				{{ props.data.type }}
			</p>
			<p class="name">
				{{ props.data.name }}
			</p>
			<p v-if="props.data.artist" class="artist">
				{{ props.data.artist }}
			</p>
		</div>
	</article>
</template>

<style scoped>
.music-home-card {
	flex: 0 0 auto;
	width: auto;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 12px;
	border: 0;
	border-radius: 20px;
	padding: 8px;
	background: transparent;
	cursor: pointer;
	contain: layout paint;
	outline: none;
}
.cover {
	flex: 0 0 96px;
	width: 96px;
	aspect-ratio: 1/1;
	border-radius: 16px;
	overflow: hidden;
}
.kind {
	margin: 0;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
}
.name {
	margin: 4px 0 0;
	font-size: 18px;
	font-weight: 600;
}
.artist {
	margin: 4px 0 0;
	font-size: 14px;
	color: var(--color-text-secondary);
}
</style>
