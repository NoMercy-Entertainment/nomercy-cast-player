<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { BACKDROP_SIZE, buildImageUrl } from '@/lib/images/urls';
import { HERO_CHANGE_MS } from '@/stores/focusedCardStore';
import SplitTitleText from '@/components/text/SplitTitleText.vue';

/*
 * Hero pinned to the top of the home view. Mirrors APK
 * components/VideoMusicHeroSection.kt's HeroRow — title (or logo when
 * present) + overview, no interactive buttons. The actual entry points
 * for Watch / Details live on the focused NMHomeCard or InfoScreen,
 * not on the hero itself. Hero is informational only.
 *
 * Backdrop layer is rendered separately by the parent screen so it can
 * persist through hero crossfades; here we only render the title +
 * overview text block aligned bottom-left.
 */

import type { FocusedCardData } from '@/stores/focusedCardStore';

const props = defineProps<{
	card: FocusedCardData;
}>();

// NMLolomo.kt:169: only a backdrop is a hero backdrop; a card without one keeps the previous slide.
const lastBackdrop = ref(props.card.backdrop);

watch(() => props.card.backdrop, (next) => {
	if (next) {
		lastBackdrop.value = next;
	}
});

const backdropUrl = computed(() =>
	buildImageUrl(props.card.backdrop ?? lastBackdrop.value ?? null, BACKDROP_SIZE),
);

const logoUrl = computed(() => buildImageUrl(props.card.logo ?? null, { width: 600 }));

const transitionKey = computed(() => props.card.id ?? props.card.title ?? '');

// BackdropImageWithOverlay.kt:83-129: preload, wipe in from the right, a running wipe always
// finishes, and only the newest request follows. The bottom layer is the shown image.
const WIPE_MS = HERO_CHANGE_MS;

interface Layer { url: string; key: number }

let layerKey = 0;
const initial = backdropUrl.value;
const layers = ref<Layer[]>(initial
	? [{ url: initial, key: layerKey++ }]
	: []);
const phase = ref<'armed' | 'running'>('armed');

let busy = false;
let pending: string | null = null;
let disposed = false;
let finishWipe: (() => void) | null = null;

function preload(url: string): Promise<void> {
	return new Promise((resolve) => {
		const image = new Image();

		image.src = url;
		(image.decode?.() ?? Promise.resolve()).then(resolve, resolve);
	});
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function wipeDone(): Promise<void> {
	return new Promise((resolve) => {
		const timer = window.setTimeout(done, WIPE_MS + 50);

		function done() {
			window.clearTimeout(timer);
			finishWipe = null;
			resolve();
		}

		finishWipe = done;
	});
}

async function wipeTo(url: string): Promise<void> {
	busy = true;

	await preload(url);

	if (!disposed) {
		if (layers.value.length === 0) {
			layers.value = [{ url, key: layerKey++ }];
		} else if (layers.value[0]?.url !== url) {
			phase.value = 'armed';
			layers.value = [...layers.value, { url, key: layerKey++ }];
			// Let the new layer draw before the clock starts, or a cold TV eats the wipe into a snap.
			await nextFrame();
			await nextFrame();
			phase.value = 'running';
			await wipeDone();
			layers.value = layers.value.slice(1);
		}
	}

	busy = false;

	const next = pending;

	pending = null;

	if (!disposed && next && next !== layers.value[0]?.url) {
		void wipeTo(next);
	}
}

watch(backdropUrl, (next) => {
	if (!next) return;

	if (busy) {
		pending = next;

		return;
	}

	void wipeTo(next);
});

onBeforeUnmount(() => {
	disposed = true;
	finishWipe?.();
});
</script>

<template>
	<section class="hero">
		<div class="art">
			<div
				v-for="(layer, index) in layers"
				:key="layer.key"
				class="hero-layer"
				:class="index > 0 ? phase : undefined"
				@animationend="index > 0 && finishWipe?.()"
			>
				<div class="hero-layer-art">
					<img
						class="nm-cover-center"
						:src="layer.url"
						:alt="card.title ?? ''"
						loading="eager"
						decoding="async"
					>
				</div>
				<div v-if="index > 0" class="hero-band" />
			</div>
			<div class="nm-hero-scrim" />
		</div>

		<Transition name="hero-fade">
			<div :key="transitionKey" class="content">
				<div class="nm-hero-title-block">
					<img
						v-if="logoUrl"
						class="nm-hero-logo"
						:src="logoUrl"
						:alt="card.title ?? ''"
					>
					<SplitTitleText
						v-else
						:title="card.title"
						main-class="nm-hero-title-main"
						subtitle-class="nm-hero-title-sub"
					/>
				</div>
				<div class="nm-hero-overview-block">
					<p v-if="card.artist" class="nm-hero-byline">
						{{ card.artist }}
					</p>
					<p v-if="card.overview" class="nm-hero-overview" :style="card.artist ? { '-webkit-line-clamp': 4 } : undefined">
						{{ card.overview }}
					</p>
				</div>
			</div>
		</Transition>
	</section>
</template>

<style scoped>
.hero {
	position: relative;
	width: 100%;
	height: var(--hero-height);
	background: oklch(0.12 0.01 250);
}
/* BackdropImageWithOverlay fills the screen; the rails and the hero text draw over it. */
.art {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100vh;
	overflow: hidden;
}
.content {
	position: absolute;
	inset: 0;
	width: 60%;
	padding: 0 16px 12px 40px;
	color: var(--cast-text-primary);
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	gap: 12px;
}

/* Edge leans 0.35 x height (BackdropImageWithOverlay.kt:165): 19.29deg = atan(0.35), 35vh = lean. */
.hero-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
	transform-origin: 0 0;
}
.hero-layer-art {
	width: 100vw;
	height: 100%;
	transform-origin: 0 0;
}
.hero-layer.armed,
.hero-layer.running {
	width: calc(100vw + 72vh);
	will-change: transform;
	transform: translate3d(calc(100vw + 35vh), 0, 0) skewX(-19.29deg);
}
.hero-layer.armed .hero-layer-art,
.hero-layer.running .hero-layer-art {
	transform: translate3d(calc(-100vw - 35vh), 0, 0) skewX(19.29deg);
}
.hero-layer.running {
	animation: hero-wipe-edge 1400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.hero-layer.running .hero-layer-art {
	animation: hero-wipe-art 1400ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.hero-band {
	position: absolute;
	top: 0;
	left: 0;
	width: 40px;
	height: 100%;
	background: var(--color-primary);
	opacity: 0.85;
}
@keyframes hero-wipe-edge {
	to {
		transform: translate3d(-35vh, 0, 0) skewX(-19.29deg);
	}
}
@keyframes hero-wipe-art {
	to {
		transform: translate3d(35vh, 0, 0) skewX(19.29deg);
	}
}

.hero-fade-enter-active,
.hero-fade-leave-active {
	transition: opacity 200ms ease;
}
.hero-fade-enter-from,
.hero-fade-leave-to {
	opacity: 0;
}
</style>
