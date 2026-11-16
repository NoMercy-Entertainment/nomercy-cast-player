<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { playbackStore } from '@/stores/playbackStore';
import { buildImageUrl } from '@/lib/images/urls';

/*
 * APK MiniPlayerTv: 40dp pill with palette-gradient background, 40dp
 * circular cover, animated equalizer spinner when playing or play icon
 * when paused, scrolling track name + artist label, click → full player.
 */

const router = useRouter();

const track = computed(() => playbackStore.music.track.value);
const isPlaying = computed(() => playbackStore.music.playing.value);
const coverUrl = computed(() => buildImageUrl(track.value?.cover ?? null, { width: 96 }));
const title = computed(() => track.value?.name ?? '');
const artist = computed(() => track.value?.artist ?? '');

const el = ref<HTMLElement | null>(null);
useFocusEntry({
	key: 'topnav-mini-player',
	el,
	onAction: () => {
		router.push('/now-playing');
	},
});
</script>

<template>
	<button
		v-if="track"
		ref="el"
		class="mini-player"
		data-focusable
		tabindex="0"
		:aria-label="`Now playing: ${title}`"
		@click.prevent="router.push('/now-playing')"
	>
		<div class="art">
			<img v-if="coverUrl" class="nm-cover-top" :src="coverUrl" :alt="title">
			<div v-if="isPlaying" class="eq" aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<svg
				v-else
				class="play-icon"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<path d="M8 5v14l11-7z" />
			</svg>
		</div>
		<div class="meta">
			<p class="title">
				{{ title }}
			</p>
			<p v-if="artist" class="artist">
				{{ artist }}
			</p>
		</div>
	</button>
</template>

<style scoped>
.mini-player {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 0 16px 0 0;
	height: 40px;
	background: linear-gradient(180deg, var(--color-primary, oklch(0.7 0.2 285 / 0.4)) 0%, oklch(0 0 0 / 0.4) 100%);
	border: 2px solid transparent;
	border-radius: 999px;
	color: #fff;
	cursor: pointer;
	font-family: inherit;
	max-width: 360px;
	min-width: 0;
	outline: none;
	transition: border-color var(--motion-fast);
}
.mini-player:focus-visible {
	border-color: var(--color-primary, oklch(0.7 0.2 285));
}
.art {
	position: relative;
	width: 40px;
	height: 40px;
	border-radius: 50%;
	overflow: hidden;
	background: oklch(0.18 0.01 250);
	flex: 0 0 auto;
	display: grid;
	place-items: center;
	color: #fff;
}
.eq {
	position: absolute;
	inset: 0;
	background: oklch(0 0 0 / 0.4);
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 2px;
}
.eq span {
	width: 3px;
	background: #fff;
	border-radius: 1px;
	animation: eq-bounce 850ms ease-in-out infinite;
}
.eq span:nth-child(1) {
	height: 6px;
	animation-delay: 0ms;
}
.eq span:nth-child(2) {
	height: 14px;
	animation-delay: 180ms;
}
.eq span:nth-child(3) {
	height: 10px;
	animation-delay: 360ms;
}
@keyframes eq-bounce {
	0%,
	100% {
		transform: scaleY(0.4);
	}
	50% {
		transform: scaleY(1);
	}
}
.play-icon {
	background: oklch(0 0 0 / 0.5);
	border-radius: 50%;
	padding: 2px;
}
.meta {
	min-width: 0;
	text-align: left;
}
.title {
	margin: 0;
	font-size: 10px;
	line-height: 12px;
	font-weight: 700;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 220px;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.artist {
	margin: 1px 0 0;
	font-size: 10px;
	color: oklch(1 0 0 / 0.85);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 220px;
}
</style>
