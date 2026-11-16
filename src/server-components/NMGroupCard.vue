<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';
import { buildImageUrl, SQUARE_SIZE } from '@/lib/images/urls';
import type { NMGroupCardWrapper, Update } from './types';

/*
 * Group card: a group with no image of its own (a music genre, a playlist
 * without a cover). The server sends the posters of the items inside; the
 * receiver draws the first one with the title, as NMMusicCard does.
 */

const props = defineProps<{
	id: string;
	data: NMGroupCardWrapper;
	update?: Update;
}>();

const router = useRouter();
const el = ref<HTMLElement | null>(null);

const cover = computed(() => buildImageUrl(props.data.item_posters?.[0]?.src, SQUARE_SIZE));

const count = computed(() => {
	const items = props.data.have_items;
	return typeof items === 'number' ? `${items} ${items === 1 ? 'item' : 'items'}` : '';
});

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
		class="group-card card nm-focus-scale"
		data-focusable
		tabindex="0"
		role="button"
	>
		<div class="cover nm-focus-ring">
			<img
				v-if="cover"
				class="nm-cover-top"
				:src="cover"
				:alt="props.data.title ?? ''"
				loading="lazy"
				decoding="async"
			>
			<FallbackPoster v-else :title="props.data.title" />
		</div>
		<div class="meta">
			<p class="name">
				{{ props.data.title }}
			</p>
			<p v-if="count" class="subtitle">
				{{ count }}
			</p>
		</div>
	</article>
</template>

<style scoped>
.group-card {
	flex: 0 0 var(--rail-card-width);
	width: var(--rail-card-width);
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
.cover {
	width: 100%;
	aspect-ratio: 2 / 3;
	border-radius: var(--radius-card);
	overflow: hidden;
	position: relative;
	background: var(--nm-surface);
}
/* TvCardViewHolder.kt:156-159: accent at alpha 0.45 fading to #1A1A1A, plus a 1 dp accent stroke. */
.cover::before {
	content: '';
	position: absolute;
	inset: 0;
	background: linear-gradient(var(--color-primary, var(--cast-white)), transparent);
	opacity: 0.45;
}
.cover::after {
	content: '';
	position: absolute;
	inset: 0;
	border: 1px solid var(--color-primary, var(--cast-white));
	border-radius: inherit;
	pointer-events: none;
}
.cover img {
	position: relative;
	width: 100%;
	height: 100%;
	object-fit: cover;
}
/* KMP draws no text under a group card; it stays in the DOM for screen readers. */
.meta {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip: rect(0 0 0 0);
	white-space: nowrap;
}
.name {
	margin: 0;
	font-size: 18px;
	font-weight: 600;
	color: var(--color-text-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.subtitle {
	margin: 0;
	font-size: 14px;
	color: var(--color-text-secondary);
}
</style>
