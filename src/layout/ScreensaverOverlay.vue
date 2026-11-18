<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppLogoSquare from '@/layout/AppLogoSquare.vue';
import { buildImageUrl, pickPaletteColor } from '@/lib/images/urls';
import { useScreensaverQuery } from '@/queries/useScreensaverQuery';
import type { ScreensaverItem } from '@/queries/useScreensaverQuery';
import { playbackStore } from '@/stores/playbackStore';
import { screensaverStore } from '@/stores/screensaverStore';

// ImageModal.kt:188,182,265,246-247,128 and ScreensaverStore.kt:261.
const TIMING = {
	fadeMs: 2500,
	holdMs: 2400,
	logoDelayMs: 4000,
	logoFadeMs: 600,
	imageMs: 40_000,
	artWidth: 3840,
	logoWidth: 500,
} as const;
// ImageModal.kt:357: one turn takes 180 s.
const TURN_SECONDS = 180;
// ImageModal.kt:367: the scale that covers every angle, plus 5%.
const COVER_MARGIN = 1.05;

const { data } = useScreensaverQuery();

const playing = playbackStore.video.playing;
const shown = computed(() => screensaverStore.active.value && !playing.value);

// ImageModal.kt:213: art the receiver cannot draw counts as no art.
const playable = computed(() => (data.value ?? []).filter((item) => artUrl(item) !== null));
const hasArt = computed(() => playable.value.length > 0);
const visible = computed(() => shown.value && hasArt.value);

const ambientArt = computed(() => {
	const t = playbackStore.music.track.value;

	if (!t?.cover)
		return null;

	return buildImageUrl(t.cover, { width: 1280, height: 1280 });
});

const bgSrc = ref<string | null>(null);
const aspect = ref(16 / 9);
const fgSrc = ref<string | null>(null);
const logoSrc = ref<string | null>(null);
const logoGlow = ref('');
const veil = ref(1);
const veilMs = ref(0);
const coverScale = ref(1);

let timers: number[] = [];
let rotation: number | null = null;
let pendingLogo: string | null = null;
let pendingGlow = '';

function artUrl(item: ScreensaverItem): string | null {
	return buildImageUrl(item.src, { width: TIMING.artWidth });
}

function later(fn: () => void, ms: number): void {
	timers.push(window.setTimeout(fn, ms));
}

function clearStage(): void {
	timers.forEach((id) => window.clearTimeout(id));
	timers = [];
}

function stop(): void {
	clearStage();

	if (rotation !== null) {
		window.clearInterval(rotation);
		rotation = null;
	}

	bgSrc.value = null;
	fgSrc.value = null;
	logoSrc.value = null;
	veil.value = 1;
	veilMs.value = 0;
}

function swapIn(item: ScreensaverItem): void {
	const logo = item.meta?.logo?.src;

	bgSrc.value = artUrl(item);
	aspect.value = item.aspectRatio || 16 / 9;
	logoSrc.value = null;

	pendingLogo = logo
		? buildImageUrl(logo, { width: TIMING.logoWidth })
		: null;

	pendingGlow = pickPaletteColor(item.meta?.logo?.color_palette?.image);

	later(() => {
		fgSrc.value = bgSrc.value;

		later(() => {
			logoSrc.value = pendingLogo;
			logoGlow.value = pendingGlow;
		}, TIMING.logoDelayMs);
	}, TIMING.holdMs);
}

function showNext(): void {
	const items = playable.value;
	const item = items[screensaverStore.advanceIndex(items.length) % items.length];

	if (!item || artUrl(item) === bgSrc.value) return;

	clearStage();
	veil.value = 1;

	if (bgSrc.value === null) {
		veilMs.value = 0;
		swapIn(item);

		return;
	}

	veilMs.value = TIMING.fadeMs;
	later(() => swapIn(item), TIMING.fadeMs);
}

// ImageModal.kt:487,308-322: the veil lifts once the foreground has loaded, or failed to.
function revealed(): void {
	veilMs.value = TIMING.fadeMs;
	veil.value = 0;
}

watch(visible, (on) => {
	if (!on) {
		stop();

		return;
	}

	coverScale.value = coverScaleFor(window.innerWidth, window.innerHeight);
	showNext();
	rotation = window.setInterval(showNext, TIMING.imageMs);
}, { immediate: true });

function coverScaleFor(w: number, h: number): number {
	const ratio = Math.max(w, h) / Math.max(Math.min(w, h), 1);

	return Math.sqrt(1 + ratio * ratio) * COVER_MARGIN;
}

onBeforeUnmount(stop);
</script>

<template>
	<div v-if="shown" class="screensaver">
		<template v-if="hasArt">
			<div
				class="stage"
				:style="{ '--cover-scale': coverScale, '--turn': `${TURN_SECONDS}s` }"
			>
				<img
					v-if="bgSrc"
					class="bg"
					data-screensaver-bg
					alt=""
					:src="bgSrc"
				>
			</div>
			<div class="center">
				<div class="card" :style="{ '--ar': aspect }">
					<img
						v-if="fgSrc"
						class="art"
						data-screensaver-art
						alt=""
						:src="fgSrc"
						@load="revealed"
						@error="revealed"
					>
					<img
						v-if="logoSrc"
						class="logo"
						data-screensaver-logo
						alt=""
						:src="logoSrc"
						:style="logoGlow ? { filter: `drop-shadow(0 0 4px ${logoGlow})` } : undefined"
					>
				</div>
			</div>
			<div class="mark">
				<AppLogoSquare />
			</div>
			<div
				class="veil"
				data-screensaver-veil
				:style="{ opacity: veil, transitionDuration: `${veilMs}ms` }"
			/>
		</template>
		<template v-else>
			<div
				v-if="ambientArt"
				class="ambient"
				:style="{ backgroundImage: `url(${ambientArt})` }"
			/>
			<div class="dim" />
		</template>
	</div>
</template>

<style scoped>
.screensaver {
	position: fixed;
	inset: 0;
	z-index: 1000;
	pointer-events: none;
	background: oklch(0 0 0);
}
.ambient {
	position: absolute;
	inset: -10%;
	background-size: cover;
	background-position: center;
	filter: blur(64px) brightness(0.35);
}
.dim {
	position: absolute;
	inset: 0;
	background: oklch(0 0 0 / 0.55);
}
.stage {
	position: absolute;
	inset: 0;
	animation: screensaver-turn var(--turn) linear infinite;
}
.bg {
	width: 100%;
	height: 100%;
	object-fit: cover;
	filter: brightness(0.5) saturate(1.2);
}
.center {
	position: absolute;
	inset: 0;
	padding: 24px 24px 16px;
	display: flex;
	align-items: center;
	justify-content: center;
}
.card {
	position: relative;
	width: min(78vw, calc(78vh * var(--ar)));
	aspect-ratio: var(--ar);
	border-radius: 16px;
	overflow: hidden;
	box-shadow: 0 12px 24px oklch(0 0 0 / 0.4);
}
.art {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.logo {
	position: absolute;
	left: 16px;
	bottom: 16px;
	max-width: calc(78vw * 0.4);
	max-height: calc(78vh * 0.35);
	animation: screensaver-logo-in 600ms linear;
}
.mark {
	position: absolute;
	right: 16px;
	bottom: 4px;
	width: 72px;
	height: 72px;
}
.veil {
	position: absolute;
	inset: 0;
	background: oklch(0 0 0);
	transition-property: opacity;
	transition-timing-function: linear;
}
@keyframes screensaver-turn {
	from {
		transform: rotate(0deg) scale(var(--cover-scale));
	}
	to {
		transform: rotate(360deg) scale(var(--cover-scale));
	}
}
@keyframes screensaver-logo-in {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}
</style>
