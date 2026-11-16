<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';
import { buildImageUrl, SQUARE_SIZE } from '@/lib/images/urls';
import type { NMTopResultCardWrapper, Update } from './types';

const props = defineProps<{
	id: string;
	data: NMTopResultCardWrapper;
	update?: Update;
}>();

const router = useRouter();
const el = ref<HTMLElement | null>(null);
const image = buildImageUrl(props.data.image, SQUARE_SIZE);

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
		class="top-result nm-focus-border"
		data-focusable
		tabindex="0"
		role="button"
	>
		<div class="art">
			<img v-if="image" class="nm-cover-top" :src="image" :alt="props.data.title">
			<FallbackPoster v-else :title="props.data.title" />
		</div>
		<div class="meta">
			<p v-if="props.data.type" class="kind">
				{{ props.data.type }}
			</p>
			<h3 class="title">
				{{ props.data.title }}
			</h3>
			<p v-if="props.data.subtitle" class="subtitle">
				{{ props.data.subtitle }}
			</p>
		</div>
	</article>
</template>

<style scoped>
.top-result {
	display: grid;
	grid-template-columns: 52px 1fr;
	align-items: center;
	height: 64px;
	gap: 8px;
	padding: 0 8px;
	background: oklch(0.18 0.01 250);
	border-radius: var(--radius-card);
	cursor: pointer;
	outline: none;
	text-align: start;
	transition:
		transform var(--motion-fast),
		box-shadow var(--motion-fast);
}
.top-result:focus-visible {
	transform: translateY(-2px);
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
}
.art {
	width: 52px;
	height: 52px;
	border-radius: 4px;
	overflow: hidden;
}
.kind {
	margin: 0;
	font-size: 12px;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-secondary);
}
.title {
	margin: 0;
	font-size: 14px;
	font-weight: 700;
}
.subtitle {
	margin: 0;
	font-size: 12px;
	color: var(--color-text-secondary);
}
</style>
