<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { BACKDROP_SIZE, buildImageUrl } from '@/lib/images/urls';
import type { NMCardWrapper, Update } from './types';

const props = defineProps<{
	id: string;
	data: NMCardWrapper;
	update?: Update;
}>();

const router = useRouter();
const el = ref<HTMLElement | null>(null);
const image = buildImageUrl(props.data.image, BACKDROP_SIZE);

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
	<article
		ref="el"
		class="genre-card nm-focus-scale-sm nm-focus-border"
		data-focusable
		tabindex="0"
		role="button"
	>
		<img v-if="image" class="art-img nm-cover-top" :src="image" :alt="props.data.title ?? ''">
		<div class="scrim" />
		<h3 class="title">
			{{ props.data.title }}
		</h3>
	</article>
</template>

<style scoped>
.genre-card {
	flex: 0 0 320px;
	width: 320px;
	aspect-ratio: 16/9;
	position: relative;
	padding: 0;
	background: oklch(0.18 0.01 250);
	cursor: pointer;
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 8px;
	overflow: hidden;
	outline: none;
}
.genre-card:focus-visible {
	border: 3px solid #fff;
}
.art-img {
	position: absolute;
	inset: 0;
}
.scrim {
	position: absolute;
	inset: 0;
	background: linear-gradient(135deg, oklch(0 0 0 / 0.6), transparent 60%);
}
.title {
	position: absolute;
	inset: auto auto 16px 16px;
	margin: 0;
	font-size: 24px;
	font-weight: 700;
	color: var(--color-text-primary);
}
</style>
