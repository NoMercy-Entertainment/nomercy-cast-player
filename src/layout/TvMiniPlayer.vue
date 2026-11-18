<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
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
const artistEl = ref<HTMLElement | null>(null);
const artistTextEl = ref<HTMLElement | null>(null);
const marqueeShift = ref(0);

// Marquee.kt:35,65: the text box holds the 16 dp end padding, so it scrolls only past it, by the whole overflow.
function measureArtist(): void {
	const box = artistEl.value;
	const text = artistTextEl.value;

	marqueeShift.value = box && text && text.offsetWidth - 16 > box.clientWidth
		? -(text.offsetWidth - box.clientWidth)
		: 0;
}

onMounted(measureArtist);

watch(artist, () =>
	void nextTick(measureArtist));

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
			<p
				v-if="artist"
				ref="artistEl"
				class="artist"
				:class="{ 'is-marquee': marqueeShift !== 0 }"
				:style="marqueeShift !== 0 ? { '--marquee-shift': `${marqueeShift}px` } : undefined"
			>
				<span ref="artistTextEl" class="artist-text">{{ artist }}</span>
			</p>
		</div>
	</button>
</template>

<style scoped>
.mini-player {
	display: inline-flex;
	align-items: center;
	gap: 8px;
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
		var(--cast-black) 100%
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
	background: linear-gradient(
		85deg,
		var(--mini-color, var(--color-primary, oklch(0.7 0.2 285))) 0%,
		var(--cast-black) 100%
	);
	opacity: 0.4;
}
/* EqSpinner.kt:24-60: five 2 dp bars 1 dp apart in a 16 dp box, each with its own delay and brightness. */
.eq {
	display: flex;
	align-items: flex-end;
	justify-content: center;
	gap: 1px;
	width: 16px;
	height: 16px;
	overflow: hidden;
}
.eq span {
	width: 2px;
	height: 100%;
	background: var(--color-primary, oklch(0.7 0.2 285));
	border-radius: 2px 2px 0 0;
	transform-origin: bottom;
	animation: eq-bounce 800ms cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
}
.eq span:nth-child(1) {
	animation-delay: 600ms;
	filter: brightness(1.3);
}
.eq span:nth-child(2) {
	animation-delay: 800ms;
	filter: brightness(1.7);
}
.eq span:nth-child(3) {
	animation-delay: 200ms;
	filter: brightness(1.2);
}
.eq span:nth-child(4) {
	animation-delay: 0ms;
	filter: brightness(1.5);
}
.eq span:nth-child(5) {
	animation-delay: 400ms;
	filter: brightness(1.1);
}
@keyframes eq-bounce {
	from {
		transform: scaleY(0.4);
	}
	to {
		transform: scaleY(1);
	}
}
.play-icon {
	color: var(--cast-text-primary);
}
/* MiniPlayer.kt:206-208: the text column takes the rest of the pill and spaces its two lines evenly. */
.meta {
	display: flex;
	flex: 1 1 0;
	flex-direction: column;
	justify-content: space-evenly;
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
}
/* TrackLinks.kt:44-46: labelSmall (Material3 default 11 / 16) Medium at 0.7 alpha, inside a Marquee. */
.artist {
	margin: 0;
	font-size: 11px;
	line-height: 16px;
	font-weight: 500;
	color: oklch(1 0 0 / 0.7);
	white-space: nowrap;
	overflow: hidden;
}
.artist-text {
	display: inline-block;
	padding-right: 16px;
}
/* Marquee.kt:49-67: wait 1.5 s, scroll 5 s, wait 1.5 s, fade out 0.5 s, reset, fade in 0.5 s. */
.artist.is-marquee .artist-text {
	animation: artist-marquee 9000ms linear infinite;
}
@keyframes artist-marquee {
	0%,
	16.67% {
		transform: translateX(0);
		opacity: 1;
	}
	72.22%,
	88.89% {
		transform: translateX(var(--marquee-shift));
		opacity: 1;
	}
	94.43% {
		transform: translateX(var(--marquee-shift));
		opacity: 0;
	}
	94.44% {
		transform: translateX(0);
		opacity: 0;
	}
	100% {
		transform: translateX(0);
		opacity: 1;
	}
}
</style>
