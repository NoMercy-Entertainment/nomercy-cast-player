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

const track = playbackStore.music.track;
const cover = computed(() =>
	track.value?.cover ? buildImageUrl(track.value.cover, { width: 800, height: 800 }) : null,
);
</script>

<template>
	<div class="hero">
		<div class="art">
			<img v-if="cover" class="nm-cover-top" :src="cover" :alt="track?.name ?? ''" decoding="async">
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
.art {
	width: 160px;
	height: 160px;
	border-radius: 16px;
	overflow: hidden;
	box-shadow: 0 16px 48px oklch(0 0 0 / 0.5);
	flex: 0 0 auto;
}
.meta {
	min-width: 0;
	flex: 1 1 auto;
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.title {
	margin: 0;
	font-size: 36px;
	font-weight: 800;
	letter-spacing: -0.02em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
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
	text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
</style>
