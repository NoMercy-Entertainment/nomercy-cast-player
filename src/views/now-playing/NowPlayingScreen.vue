<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import NowPlayingHero from '@/players/music/NowPlayingHero.vue';
import ProgressControls from '@/players/music/ProgressControls.vue';
import QueuePeek from '@/players/music/QueuePeek.vue';
import Lyrics from '@/players/music/Lyrics.vue';
import { leaveToPreviousOrHome } from '@/router/leave';
import { playbackStore } from '@/stores/playbackStore';
import { buildImageUrl } from '@/lib/images/urls';
import { applyThemeColor } from '@/lib/theme';

/*
 * APK FullPlayerScreenTV: artist backdrop fills the screen, scrim ramps
 * darker on the controls side, palette colour tints the play button,
 * controls auto-hide after 5s of no input. We mirror the same envelope
 * here — backdrop layer → scrim → content grid.
 */

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
const likeEl = ref<HTMLElement | null>(null);
const lyricsEl = ref<HTMLElement | null>(null);

const track = playbackStore.music.track;
const lyricsOpen = playbackStore.music.lyricsOpen;

const backdropUrl = computed(() => {
	const t = track.value;
	if (!t)
		return null;
	const path = t.backdrop ?? t.cover ?? null;
	if (!path)
		return null;
	return buildImageUrl(path, { width: 1920 });
});

watch(track, (next) => {
	const palette = next?.color_palette;
	applyThemeColor(palette?.cover ?? palette?.image ?? palette?.backdrop ?? null);
}, { immediate: true });

useFocusEntry({
	key: 'np-close',
	group: utilityGroup,
	el: closeEl,
	onAction: () => {
		leaveToPreviousOrHome(router);
	},
});
useFocusEntry({
	key: 'np-like',
	group: utilityGroup,
	el: likeEl,
	onAction: () => {
		const next = !track.value?.favorite;
		playbackStore.music.applyFavorite(next);
	},
});
useFocusEntry({
	key: 'np-lyrics',
	group: utilityGroup,
	el: lyricsEl,
	onAction: () => {
		playbackStore.music.applyLyricsOpen(!lyricsOpen.value);
	},
});

const idleHide = ref(false);
let idleTimer: number | null = null;
function bumpIdle(): void {
	idleHide.value = false;
	if (idleTimer !== null)
		window.clearTimeout(idleTimer);
	idleTimer = window.setTimeout(() => {
		idleHide.value = true;
	}, 5000);
}
onMounted(() => {
	bumpIdle();
	window.addEventListener('keydown', bumpIdle);
	window.addEventListener('mousemove', bumpIdle);
});
onUnmounted(() => {
	if (idleTimer !== null)
		window.clearTimeout(idleTimer);
	window.removeEventListener('keydown', bumpIdle);
	window.removeEventListener('mousemove', bumpIdle);
});
</script>

<template>
	<div ref="containerEl" class="now-playing" :class="[{ 'controls-hidden': idleHide }]">
		<div
			v-if="backdropUrl"
			class="art-backdrop"
			:style="{ backgroundImage: `url(${backdropUrl})` }"
		/>
		<div class="art-scrim" />

		<div ref="utilityRowEl" class="utility-row">
			<button
				ref="closeEl"
				data-focusable
				tabindex="0"
				class="util-btn"
				aria-label="Close"
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
					<line x1="6" y1="6" x2="18" y2="18" />
					<line x1="18" y1="6" x2="6" y2="18" />
				</svg>
			</button>
			<button
				ref="likeEl"
				data-focusable
				tabindex="0"
				class="util-btn"
				:class="{ active: track?.favorite }"
				aria-label="Like"
			>
				<svg
					v-if="track?.favorite"
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10z" />
				</svg>
				<svg
					v-else
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
				</svg>
			</button>
			<button
				ref="lyricsEl"
				data-focusable
				tabindex="0"
				class="util-btn"
				:class="{ active: lyricsOpen }"
				aria-label="Lyrics"
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="4" y1="6" x2="20" y2="6" />
					<line x1="4" y1="12" x2="20" y2="12" />
					<line x1="4" y1="18" x2="14" y2="18" />
				</svg>
			</button>
		</div>

		<div class="content">
			<div class="left">
				<NowPlayingHero v-show="!lyricsOpen" />
				<Lyrics v-show="lyricsOpen" />
				<ProgressControls />
			</div>
			<div class="right">
				<QueuePeek />
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
}
.art-backdrop {
	position: absolute;
	inset: -10%;
	background-size: cover;
	background-position: center;
	filter: blur(40px) brightness(0.6);
	z-index: 0;
	transform: scale(1.05);
}
.art-scrim {
	position: absolute;
	inset: 0;
	background:
		linear-gradient(180deg, oklch(0 0 0 / 0.15) 0%, oklch(0 0 0 / 0.45) 60%, oklch(0 0 0 / 0.85) 100%),
		linear-gradient(90deg, oklch(0 0 0 / 0.55) 0%, oklch(0 0 0 / 0.35) 50%, oklch(0 0 0 / 0.55) 100%);
	z-index: 1;
}
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
	border: 0;
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
	border: 2px solid transparent;
}
.util-btn.active {
	color: var(--color-primary, var(--color-accent));
}
.util-btn:focus-visible {
	transform: scale(1.08);
	background: oklch(0 0 0 / 0.7);
	border-color: oklch(1 0 0 / 0.85);
}
.content {
	position: relative;
	z-index: 2;
	display: grid;
	grid-template-columns: 1fr minmax(280px, auto);
	gap: 48px;
	padding: 80px var(--tv-safe-padding) 48px;
	height: 100%;
	align-items: end;
	transition: transform 400ms ease;
}
.controls-hidden .content {
	transform: translateY(0);
}
.left {
	display: flex;
	flex-direction: column;
	gap: 32px;
	align-items: stretch;
}
.right {
	align-self: end;
	padding-bottom: 24px;
	transition: opacity 300ms ease;
}
.controls-hidden .right {
	opacity: 0;
	pointer-events: none;
}
</style>
