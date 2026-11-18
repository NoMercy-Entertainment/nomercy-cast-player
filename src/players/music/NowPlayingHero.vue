<script setup lang="ts">
import { computed } from 'vue';
import { playbackStore } from '@/stores/playbackStore';
import { buildImageUrl } from '@/lib/images/urls';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';

/*
 * APK FullPlayerScreenTV.TopRowTV — artwork (160dp) + title/artist column
 * laid out as a horizontal Row anchored bottom-left. Title 36sp ExtraBold,
 * artist 22sp Medium with 0.8 alpha. We mirror sizes/proportions but use
 * fluid units so the layout still works at non-1080p resolutions.
 */

// FullPlayerScreen.kt: while lyrics show, artwork is 60dp and the title scales to 0.72.
// FullPlayerScreen.kt:188-207: with the controls hidden, artwork is 120dp and the title scales to 0.85.
const props = defineProps<{ compact?: boolean; idle?: boolean }>();
const idleOnly = computed(() => props.idle === true && !props.compact);

const track = playbackStore.music.track;
const cover = computed(() =>
	track.value?.cover
		? buildImageUrl(track.value.cover, { width: 800, height: 800 })
		: null,
);
</script>

<template>
	<div class="hero" :class="{ 'is-compact': compact, 'is-idle': idleOnly }">
		<div class="art">
			<img v-if="cover"
				class="nm-cover-top"
				:src="cover"
				:alt="track?.name ?? ''"
				decoding="async"
			>
			<FallbackPoster v-else :title="track?.name" />
		</div>
		<div class="meta">
			<h1 class="title">
				{{ track?.name ?? '—' }}
			</h1>
			<p v-if="track?.artist" class="artist">
				{{ track.artist }}
			</p>
			<p v-else-if="track?.album" class="album">
				{{ track.album }}
			</p>
		</div>
	</div>
</template>

<style scoped>
.hero {
	display: flex;
	align-items: flex-end;
	gap: 16px;
	width: 100%;
}
/* CoverArtwork (mobile FullPlayerScreen.kt:475): 8 dp corners; the TV row adds no shadow. */
.art {
	width: 160px;
	height: 160px;
	border-radius: 8px;
	overflow: hidden;
	flex: 0 0 auto;
	transition:
		width 500ms ease,
		height 500ms ease;
}
.hero.is-idle .art {
	width: 120px;
	height: 120px;
}
.hero.is-compact .art {
	width: 60px;
	height: 60px;
}
.hero.is-idle .title {
	font-size: calc(36px * 0.85);
}
.hero.is-idle .artist,
.hero.is-idle .album {
	font-size: calc(22px * 0.85);
}
.hero.is-compact .title {
	font-size: calc(36px * 0.72);
}
.hero.is-compact .artist,
.hero.is-compact .album {
	font-size: calc(22px * 0.72);
}
.hero.is-compact .meta {
	gap: 2px;
}
.meta {
	min-width: 0;
	flex: 1 1 auto;
	display: flex;
	flex-direction: column;
	gap: 8px;
	transition: gap 500ms ease;
}
.title {
	margin: 0;
	font-size: 36px;
	font-weight: 800;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	transition: font-size 500ms ease;
}
.artist,
.album {
	margin: 0;
	font-size: 22px;
	font-weight: 500;
	color: oklch(1 0 0 / 0.8);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	transition: font-size 500ms ease;
}
</style>
