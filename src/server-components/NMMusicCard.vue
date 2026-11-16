<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';
import { buildImageUrl, SQUARE_SIZE } from '@/lib/images/urls';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { NMMusicCardWrapper, Update } from './types';

/*
 * Music card. Mirrors APK NMMusicCard.kt:
 *   - Square cover, scale 1→1.03 on focus, palette-tinted border
 *   - Subtitle row with type label + track count or year
 *   - Letter cards (alphabet jump) render the letter centred at title size
 *   - Focus publishes to focusedCardStore so the parent hero updates
 */

const props = defineProps<{
	id: string;
	data: NMMusicCardWrapper;
	update?: Update;
}>();

const { t } = useTranslation();
const router = useRouter();
const el = ref<HTMLElement | null>(null);

const wrapperData = computed(() => props.data as unknown as Record<string, unknown>);
const cardType = computed(() => (wrapperData.value.type as string | undefined) ?? '');
const isLetterCard = computed(() => cardType.value === 'letter');

const cover = computed(() =>
	buildImageUrl(props.data.cover ?? null, SQUARE_SIZE),
);

const typeLabel = computed(() => {
	switch (cardType.value) {
		case 'playlist':
		case 'favorite':
			return t('components.music_card_type.playlist');
		case 'album':
			return t('components.music_card_type.album');
		case 'artist':
			return t('components.music_card_type.artist');
		case 'release_groups':
		case 'release_group':
			return t('components.music_card_type.release');
		case 'genres':
		case 'genre':
			return t('components.music_card_type.genre');
		default:
			return '';
	}
});

const subtitle = computed(() => {
	if (isLetterCard.value)
		return '';

	const tracks = wrapperData.value.tracks as number | undefined;
	const year = wrapperData.value.year as number | string | undefined;
	const tail = typeof tracks === 'number'
		? t('components.track_count', { count: tracks })
		: (year
				? String(year)
				: '');

	if (typeLabel.value && tail)
		return `${typeLabel.value} • ${tail}`;

	return typeLabel.value || tail;
});

useFocusEntry({
	key: props.id,
	el,
	onAction: () => {
		if (props.data.link) {
			router.push(props.data.link);
		}
	},
	onFocus: () => {
		focusedCardStore.setActive({
			id: props.id,
			title: props.data.name,
			poster: props.data.cover,
			link: props.data.link,
			type: cardType.value,
			color_palette: (wrapperData.value.color_palette as never) ??
				(wrapperData.value.colorPalette as never),
		});
	},
});
</script>

<template>
	<article
		ref="el"
		class="music-card card nm-focus-scale"
		:class="[{ 'is-letter': isLetterCard }]"
		data-focusable
		tabindex="0"
		role="button"
	>
		<div class="cover nm-focus-ring">
			<template v-if="isLetterCard">
				<div class="letter">
					{{ props.data.name }}
				</div>
			</template>
			<template v-else>
				<img
					v-if="cover"
					class="nm-cover-top"
					:src="cover"
					:alt="props.data.name ?? ''"
					loading="lazy"
					decoding="async"
				>
				<FallbackPoster v-else :title="props.data.name" />
			</template>
		</div>
		<div v-if="!isLetterCard" class="meta">
			<p class="name">
				{{ props.data.name }}
			</p>
			<p v-if="subtitle" class="subtitle">
				{{ subtitle }}
			</p>
		</div>
	</article>
</template>

<style scoped>
.music-card {
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
	aspect-ratio: 1 / 1;
	border-radius: var(--radius-card);
	overflow: hidden;
	background: oklch(0.18 0.01 250);
	position: relative;
	display: grid;
	place-items: center;
}
.is-letter .cover {
	background: linear-gradient(135deg, oklch(0.22 0.06 285), oklch(0.18 0.04 250));
}
.letter {
	font-size: 64px;
	font-weight: 800;
	color: var(--cast-text-primary);
	letter-spacing: -0.04em;
	text-transform: uppercase;
}
.meta {
	padding: 0 4px;
}
.name {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	line-height: 1.2;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.subtitle {
	margin: 4px 0 0;
	font-size: 12px;
	color: var(--color-text-secondary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
