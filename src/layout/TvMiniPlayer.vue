<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import { playbackStore } from '@/stores/playbackStore';
import { settingsStore } from '@/stores/settingsStore';
import { pickPaletteColor } from '@/lib/images/urls';

/*
 * APK MiniPlayerTv: 40dp pill with palette-gradient background, 40dp
 * circular cover, animated equalizer spinner when playing or play icon
 * when paused, scrolling track name + artist label, click → full player.
 */

const { t } = useTranslation();
const router = useRouter();

const track = computed(() => playbackStore.music.track.value);
const isPlaying = computed(() => playbackStore.music.playing.value);
const title = computed(() => track.value?.name ?? '');
const artist = computed(() => track.value?.artist ?? '');

// MiniPlayer.kt:63-70: the song's own palette, or the theme color (the CSS fallback) with auto colors off.
const pillStyle = computed(() => {
	const palette = track.value?.color_palette;
	const source = palette?.cover ?? palette?.image ?? palette?.backdrop ?? palette?.profile ?? null;
	const color = settingsStore.useAutoThemeColors.value
		? pickPaletteColor(source, 20, 160)
		: '';

	return color
		? { '--mini-color': color }
		: undefined;
});

const el = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'topnav-mini-player',
	el,
	// It mounts once a song plays, after the tabs registered; it still sits left of Home.
	order: -1,
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
		:style="pillStyle"
		data-focusable
		tabindex="0"
		:aria-label="t('layout.mini_player.aria', { title })"
		@click.prevent="router.push('/now-playing')"
	>
		<div class="art">
			<div v-if="isPlaying" class="eq" aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<MoooomIcon
				v-else
				class="play-icon"
				icon="nmPlay"
				width="20"
				height="20"
			/>
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
	position: relative;
	isolation: isolate;
	border: 2px solid transparent;
	border-radius: 999px;
	color: var(--cast-text-primary);
	cursor: pointer;
	font-family: inherit;
	width: 360px;
	max-width: 100%;
	min-width: 0;
	outline: none;
	transition: border-color var(--motion-fast);
}
.mini-player:focus-visible {
	border-color: var(--color-primary, oklch(0.7 0.2 285));
}
/* MiniPlayer.kt:98-105: the color at 40% down to black at 40%, drawn under the border too. */
.mini-player::before {
	content: '';
	position: absolute;
	inset: -2px;
	z-index: -1;
	border-radius: inherit;
	background: linear-gradient(
		180deg,
		var(--mini-color, var(--color-primary, oklch(0.7 0.2 285))) 0%,
		oklch(0 0 0) 100%
	);
	opacity: 0.4;
}
.art {
	position: relative;
	isolation: isolate;
	width: 40px;
	height: 40px;
	border-radius: 50%;
	overflow: hidden;
	flex: 0 0 auto;
	display: grid;
	place-items: center;
	color: var(--cast-text-primary);
}
/* MiniPlayer.kt:174-186: the same gradient, turned -95 deg. */
.art::before {
	content: '';
	position: absolute;
	inset: 0;
	z-index: -1;
	background: linear-gradient(85deg, var(--mini-color, var(--color-primary, oklch(0.7 0.2 285))) 0%, oklch(0 0 0) 100%);
	opacity: 0.4;
}
.eq {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 2px;
}
.eq span {
	width: 3px;
	background: var(--cast-white);
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
	color: var(--cast-text-primary);
}
.meta {
	min-width: 0;
	text-align: left;
}
.title {
	margin: 0;
	font-size: 10px;
	line-height: 12px;
	font-weight: 500;
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
