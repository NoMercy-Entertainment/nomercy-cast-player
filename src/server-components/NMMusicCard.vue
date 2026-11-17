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
 *   - Letter cards (alphabet jump) render the letter centered at title size
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

const cardType = computed(() => props.data.type ?? '');
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

	const tracks = props.data.tracks;
	const year = props.data.year
		? String(props.data.year)
		: '';
	const tail = typeof tracks === 'number'
		? t('components.track_count', { count: tracks })
		: year;

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
			overview: props.data.description,
			artist: props.data.artist,
			backdrop: props.data.cover,
			logo: props.data.logo,
			link: props.data.link,
			type: cardType.value,
			color_palette: props.data.color_palette ?? props.data.colorPalette,
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
	transition: transform 120ms cubic-bezier(0.4, 0, 0.2, 1);
}
/* NMMusicCard.kt:139,197: activeScale 1.03 over a 120 ms FastOutSlowIn tween. */
.music-card:focus-visible {
	transform: scale(1.03);
}
.cover {
	width: 100%;
	aspect-ratio: 1 / 1;
	margin: 4px;
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
	padding: 8px 4px;
}
.name {
	margin: 0;
	font-size: 11px;
	font-weight: 500;
	line-height: 16px;
	letter-spacing: 0.5px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.subtitle {
	margin: 2px 0 0;
	font-size: 11px;
	font-weight: 500;
	line-height: 16px;
	letter-spacing: 0.5px;
	opacity: 0.7;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
