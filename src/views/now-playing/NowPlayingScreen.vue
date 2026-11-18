<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import NowPlayingHero from '@/players/music/NowPlayingHero.vue';
import ProgressControls from '@/players/music/ProgressControls.vue';
import QueuePeek from '@/players/music/QueuePeek.vue';
import Lyrics from '@/players/music/Lyrics.vue';
import { leaveToPreviousOrHome } from '@/router/leave';
import { playbackStore } from '@/stores/playbackStore';
import { settingsStore } from '@/stores/settingsStore';
import { buildImageUrl, pickPaletteColor } from '@/lib/images/urls';
import { applyThemeColor, constrainGroundColor } from '@/lib/theme';

/*
 * FullPlayerScreenTV: the artist backdrop, a ground-color scrim, the title row sitting
 * above a bottom bar that slides away after 5 s without input.
 */

const { t } = useTranslation();
const router = useRouter();

const containerEl = ref<HTMLElement | null>(null);

useFocusGroup({
	type: 'vertical',
	restorationKey: 'now-playing',
	containerEl,
});

const utilityRowEl = ref<HTMLElement | null>(null);
const utilityGroup = useFocusGroup({
	type: 'horizontal',
	restorationKey: 'now-playing-utility',
	containerEl: utilityRowEl,
});

const closeEl = ref<HTMLElement | null>(null);

const track = playbackStore.music.track;
const lyricsOpen = playbackStore.music.lyricsOpen;
const dark = settingsStore.tvDarkMode;
const hasQueue = computed(() => playbackStore.music.queue.value.length > 0);

// FullPlayerScreen.kt:170-180: only the track's own backdrop, none in dark mode.
const backdropUrl = computed(() => {
	const path = track.value?.backdrop;

	if (!path || dark.value)
		return null;

	return buildImageUrl(path, { width: 1920 });
});

const palette = computed(() => {
	const p = track.value?.color_palette;

	return p?.cover ?? p?.image ?? p?.backdrop ?? p?.profile ?? p?.poster ?? null;
});

// FullPlayerScreen.kt:321-333: the ground color at 0.55 (1 without a backdrop) down to black at 0.85 (1).
const scrim = computed(() => {
	const top = backdropUrl.value
		? 0.55
		: 1;
	const bottom = backdropUrl.value
		? 0.85
		: 1;
	const hex = dark.value
		? ''
		: pickPaletteColor(palette.value);
	const n = hex
		? Number.parseInt(constrainGroundColor(hex).replace('#', ''), 16)
		: 0;

	return `linear-gradient(180deg, rgba(${(n >> 16) & 0xFF}, ${(n >> 8) & 0xFF}, ${n & 0xFF}, ${top}), rgba(0, 0, 0, ${bottom}))`;
});

watch(track, (next) => {
	const p = next?.color_palette;

	applyThemeColor(p?.cover ?? p?.image ?? p?.backdrop ?? null);
}, { immediate: true });

useFocusEntry({
	key: 'np-close',
	group: utilityGroup,
	el: closeEl,
	onAction: () => {
		leaveToPreviousOrHome(router);
	},
});

const idleHide = ref(false);
let idleTimer: number | null = null;

function bumpIdle(): void {
	idleHide.value = false;

	if (idleTimer !== null) {
		window.clearTimeout(idleTimer);
	}

	idleTimer = window.setTimeout(() => {
		idleHide.value = true;
	}, 5000);
}

// FullPlayerScreen.kt:246-251: when the bar comes back, the play button takes focus after 200 ms.
watch(idleHide, (hidden) => {
	if (hidden) return;

	window.setTimeout(() => {
		containerEl.value?.querySelector<HTMLElement>('.ctrl-play')?.focus({ preventScroll: true });
	}, 200);
});

onMounted(() => {
	bumpIdle();
	window.addEventListener('keydown', bumpIdle);
	window.addEventListener('mousemove', bumpIdle);
});

onUnmounted(() => {
	if (idleTimer !== null) {
		window.clearTimeout(idleTimer);
	}

	window.removeEventListener('keydown', bumpIdle);
	window.removeEventListener('mousemove', bumpIdle);
});
</script>

<template>
	<div
		ref="containerEl"
		class="now-playing"
		:class="{ 'controls-hidden': idleHide, 'is-lyrics': lyricsOpen, 'is-dark': dark }"
	>
		<div
			v-if="backdropUrl"
			class="art-backdrop"
			:style="{ backgroundImage: `url(${backdropUrl})` }"
		/>
		<div class="art-scrim" :style="{ background: scrim }" />

		<div ref="utilityRowEl" class="utility-row">
			<button
				ref="closeEl"
				data-focusable
				tabindex="0"
				class="util-btn"
				:aria-label="t('common.close')"
			>
				<MoooomIcon icon="cross" width="22" height="22" />
			</button>
		</div>

		<div class="content">
			<Transition name="lyrics-fade">
				<Lyrics v-show="lyricsOpen" class="lyrics-layer" />
			</Transition>
			<div class="top-row" :class="{ 'has-queue': hasQueue }">
				<NowPlayingHero :compact="lyricsOpen" :idle="idleHide" />
			</div>
			<div class="right">
				<QueuePeek />
			</div>
			<div class="bar-wrap" :class="{ 'is-hidden': idleHide }">
				<ProgressControls />
			</div>
		</div>
	</div>
</template>

<style scoped>
.now-playing {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	background: var(--cast-black);
}
/* FullPlayerScreen.kt:303-313: scaled 1.35 from the top center so the bottom hangs off and is clipped. */
.art-backdrop {
	position: absolute;
	inset: 0;
	background-size: cover;
	background-position: top center;
	transform: scale(1.35);
	transform-origin: 50% 0;
	z-index: 0;
}
.art-scrim {
	position: absolute;
	inset: 0;
	z-index: 1;
}
/* The close button has no KMP twin (Back closes there); it stays in its corner. */
.utility-row {
	position: absolute;
	top: 32px;
	right: 36px;
	z-index: 3;
	display: flex;
	gap: 12px;
	transition: opacity 300ms ease;
}
.controls-hidden .utility-row {
	opacity: 0.2;
}
.util-btn {
	width: 44px;
	height: 44px;
	border-radius: 50%;
	background: oklch(0 0 0 / 0.45);
	color: oklch(1 0 0 / 0.85);
	display: grid;
	place-items: center;
	cursor: pointer;
	outline: none;
	transition:
		transform var(--motion-fast),
		background var(--motion-fast),
		color var(--motion-fast),
		border-color var(--motion-fast);
	border: var(--focus-ring-width) solid transparent;
}
.util-btn:focus-visible {
	transform: scale(1.08);
	background: oklch(0 0 0 / 0.7);
	border-color: var(--cast-white);
}
/* FullPlayerScreen.kt:341-353: 48 dp each side over a transparent to black 0.7 wash. */
.content {
	position: absolute;
	inset: 0;
	z-index: 2;
	padding: 0 48px;
	background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.7) 100%);
}
/* FullPlayerScreen.kt:351, 374: the 48 dp content padding plus 60 dp. */
.lyrics-layer {
	position: absolute;
	inset: 60px 108px 0;
}
/* FullPlayerScreen.kt:356-359: fade in over 500 ms, out over 300 ms. */
.lyrics-fade-enter-active {
	transition: opacity 500ms ease;
}
.lyrics-fade-leave-active {
	transition: opacity 300ms ease;
}
.lyrics-fade-enter-from,
.lyrics-fade-leave-to {
	opacity: 0;
}
/* FullPlayerScreen.kt:209-231: bottom 198 above the bar (48 with it hidden), top 32 with lyrics. */
.top-row {
	position: absolute;
	left: 48px;
	right: 48px;
	top: calc(100% - 198px - 160px);
	transition: top 500ms ease;
}
.top-row.has-queue {
	right: calc(48px + 360px + 48px);
}
.now-playing.controls-hidden .top-row {
	top: calc(100% - 48px - 120px);
}
.now-playing.is-lyrics .top-row {
	top: 32px;
}
.right {
	position: absolute;
	right: 48px;
	bottom: 198px;
	transition: opacity 300ms ease;
}
.controls-hidden .right {
	opacity: 0;
	pointer-events: none;
}
/* FullPlayerScreen.kt:414-421: the bar floats 48 dp above the edge and slides out of view. */
.bar-wrap {
	position: absolute;
	left: 48px;
	right: 48px;
	bottom: 48px;
	transition: transform 300ms ease;
}
/* Hidden after the slide, so its buttons leave the focus order. */
.bar-wrap.is-hidden {
	transform: translateY(calc(100% + 48px));
	visibility: hidden;
	transition:
		transform 300ms ease,
		visibility 0s linear 300ms;
}
/* FullPlayerScreen.kt:153-154, 553-554: dark mode tints with black and turns the play button white. */
.now-playing.is-dark {
	--color-primary: var(--cast-black);
	--play-bg: var(--cast-white);
	--play-fg: var(--cast-black);
}
</style>
