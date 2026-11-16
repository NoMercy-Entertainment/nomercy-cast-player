<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';
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
	<article ref="el"
		class="hero-card nm-focus-scale-sm"
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
				loading="lazy"
				decoding="async"
			>
			<FallbackPoster v-else :title="props.data.title" />
		</div>
		<div class="meta">
			<p class="title">
				{{ props.data.title }}
			</p>
			<p v-if="props.data.subtitle" class="subtitle">
				{{ props.data.subtitle }}
			</p>
		</div>
	</article>
</template>

<style scoped>
.hero-card {
	flex: 0 0 calc((100vw - 40px - 42px - 24px) / 3);
	width: calc((100vw - 40px - 42px - 24px) / 3);
	display: flex;
	flex-direction: column;
	gap: 8px;
	border: 0;
	padding: 0;
	background: transparent;
	cursor: pointer;
	contain: layout paint;
	outline: none;
}
.art {
	width: 100%;
	aspect-ratio: 16/9;
	border-radius: var(--radius-card);
	overflow: hidden;
}
.title {
	margin: 0;
	font-size: 18px;
	font-weight: 600;
}
.subtitle {
	margin: 4px 0 0;
	font-size: 14px;
	color: var(--color-text-secondary);
}
</style>
