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
const imageUrl = buildImageUrl(props.data.image, BACKDROP_SIZE);
const logoUrl = buildImageUrl(props.data.logo, { width: 480 });

useFocusEntry({
	key: props.id,
	el,
	onAction: () => {
		if (props.data.link) {
			router.push(props.data.link);
		}
	},
});
</script>

<template>
	<section ref="el"
		class="hero nm-focus-scale-sm"
		data-focusable
		tabindex="0"
		role="button"
	>
		<div class="art nm-focus-ring">
			<img
				v-if="imageUrl"
				class="nm-cover-top"
				:src="imageUrl"
				:alt="props.data.title ?? ''"
				decoding="async"
			>
			<div class="nm-hero-scrim" />
		</div>
		<div class="meta">
			<img v-if="logoUrl" :src="logoUrl" :alt="props.data.title ?? ''" class="logo">
			<h1 v-else class="title">
				{{ props.data.title }}
			</h1>
			<p v-if="props.data.description" class="description">
				{{ props.data.description }}
			</p>
		</div>
	</section>
</template>

<style scoped>
.hero {
	position: relative;
	width: 100%;
	aspect-ratio: 21/9;
	display: block;
	border: 0;
	padding: 0;
	background: transparent;
	cursor: pointer;
	contain: layout paint;
	outline: none;
	overflow: hidden;
	border-radius: var(--radius-card);
}
.art {
	position: absolute;
	inset: 0;
}
.meta {
	position: absolute;
	inset: auto 5% 8% 5%;
	max-width: 60%;
}
.logo {
	max-height: 120px;
	max-width: 480px;
}
.title {
	margin: 0;
	font-size: 56px;
	font-weight: 700;
}
.description {
	margin: 12px 0 0;
	font-size: 18px;
	color: var(--color-text-secondary);
	line-height: 1.4;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
