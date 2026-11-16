<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';
import { BACKDROP_SIZE, buildImageUrl, pickPaletteColor, POSTER_SIZE } from '@/lib/images/urls';
import type { PaletteColors } from '@/lib/images/urls';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { NMCardWrapper, Update } from './types';

/*
 * Card cell. Mirrors APK NMCard.kt — poster on top, title + optional
 * subtitle below, focus animation scale-up + palette-tinted border, and
 * Continue Watching progress bar overlay when data.progress is present.
 *
 * On focus we publish the card's data to focusedCardStore so the home
 * hero can swap its backdrop / title / overview to match — same flow
 * as TvHomeScreen.kt's activeCardState.
 */
const props = defineProps<{
	id: string;
	data: NMCardWrapper;
	update?: Update;
}>();

const router = useRouter();
const el = ref<HTMLElement | null>(null);

const wrapperData = computed(() => props.data as unknown as Record<string, unknown>);

const imageSource = computed(() => {
	const d = wrapperData.value;
	return (
		(props.data.image as string | undefined)
		?? (d.poster as string | undefined)
		?? (d.backdrop as string | undefined)
	);
});

const imageUrl = computed(() => buildImageUrl(imageSource.value, props.data.wide ? BACKDROP_SIZE : POSTER_SIZE));

const accent = computed(() =>
	pickPaletteColor((wrapperData.value.color_palette ?? wrapperData.value.colorPalette) as PaletteColors | undefined),
);

const progressPct = computed(() => {
	const p = (props.data as unknown as { progress?: { time?: number; total?: number } }).progress;
	if (!p?.time || !p?.total)
		return 0;
	return Math.min(100, (p.time / p.total) * 100);
});

// TvCardViewHolder.kt:213-239: a subtitle card or an episode card carries a caption strip.
const captionSubtitle = computed(() => props.data.subtitle?.replace('(voice)', '').trim() || undefined);
const isEpisode = computed(() => props.data.type === 'episode');
const hasCaption = computed(() => Boolean(props.data.subtitle) || isEpisode.value);

useFocusEntry({
	key: props.id,
	el,
	onAction: () => {
		if (props.data.link)
			router.push(props.data.link);
	},
	onFocus: () => {
		// Publish to the home hero — mirrors APK activeCardState updates
		// from carousel item focus events.
		focusedCardStore.setActive({
			id: props.id,
			title: props.data.title,
			overview: (wrapperData.value.overview as string | undefined),
			backdrop: (wrapperData.value.backdrop as string | undefined),
			poster: (wrapperData.value.poster as string | undefined),
			logo: (wrapperData.value.logo as string | undefined),
			link: props.data.link,
			year: (wrapperData.value.year as number | undefined),
			type: (wrapperData.value.type as string | undefined),
			color_palette: (wrapperData.value.color_palette as never) ?? (wrapperData.value.colorPalette as never),
			have_items: (wrapperData.value.have_items as number | undefined),
			number_of_items: (wrapperData.value.number_of_items as number | undefined),
		});
	},
});
</script>

<template>
	<article
		ref="el"
		class="card nm-focus-scale"
		:class="{ 'card-wide': props.data.wide }"
		data-focusable
		tabindex="0"
		role="button"
	>
		<div class="poster nm-focus-ring" :style="accent ? { '--card-accent': accent } : undefined">
			<img
				v-if="imageUrl"
				class="nm-cover-top"
				:src="imageUrl"
				:alt="props.data.title ?? ''"
				loading="lazy"
				decoding="async"
			>
			<FallbackPoster v-else :title="props.data.title" />
			<div v-if="hasCaption" class="caption">
				<p class="caption-title" :class="{ 'caption-title-2': isEpisode && !captionSubtitle }">
					{{ props.data.title }}
				</p>
				<p v-if="captionSubtitle" class="caption-subtitle">
					{{ captionSubtitle }}
				</p>
			</div>
			<div
				v-if="progressPct > 0"
				class="progress"
				:style="{ width: `${progressPct}%` }"
			/>
		</div>
	</article>
</template>

<style scoped>
.card {
	flex: 0 0 var(--rail-card-width);
	width: var(--rail-card-width);
	display: flex;
	flex-direction: column;
	gap: 8px;
	border: 0;
	background: transparent;
	padding: 0;
	cursor: pointer;
	contain: layout paint;
	outline: none;
}
.card-wide {
	flex: 0 0 calc((100vw - 40px - 42px - 24px) / 3);
	width: calc((100vw - 40px - 42px - 24px) / 3);
}
.poster {
	width: 100%;
	aspect-ratio: 2/3;
	border-radius: var(--radius-card);
	overflow: hidden;
	background: oklch(0.18 0.01 250);
	position: relative;
}
.card-wide .poster {
	aspect-ratio: 16 / 9;
}
/* TvCardViewHolder.kt:79-102: a 1 dp palette stroke at rest, replaced by the white ring on focus. */
.poster::after {
	content: '';
	position: absolute;
	inset: 0;
	border: 1px solid var(--card-accent, rgba(255, 255, 255, 0.18));
	border-radius: inherit;
	pointer-events: none;
}
.card:focus-visible .poster::after {
	border-color: transparent;
}
.progress {
	position: absolute;
	inset: auto 0 0 0;
	height: 3px;
	background: var(--color-primary, oklch(0.7 0.2 285));
	box-shadow: 0 0 8px var(--color-primary, oklch(0.7 0.2 285));
}
.caption {
	position: absolute;
	inset: auto 0 0 0;
	padding: 4px 8px;
	background: rgba(26, 26, 26, 0.749);
	color: var(--nm-text-primary);
	font-weight: 500;
}
.caption p {
	margin: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-box-orient: vertical;
}
.caption-title {
	font-size: 11px;
	font-weight: 500;
	-webkit-line-clamp: 1;
}
.caption-title-2 {
	-webkit-line-clamp: 2;
}
.caption-subtitle {
	font-size: 10px;
	font-weight: 500;
	-webkit-line-clamp: 1;
}
</style>
