<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { BACKDROP_SIZE, buildImageUrl } from '@/lib/images/urls';
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
</script>

<template>
	<section class="hero">
		<Transition name="hero-fade">
			<div :key="transitionKey" class="art">
				<img
					v-if="backdropUrl"
					class="nm-cover-center"
					:src="backdropUrl"
					:alt="card.title ?? ''"
					loading="eager"
					decoding="async"
				>
				<div class="nm-hero-scrim" />
			</div>
		</Transition>

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

.hero-fade-enter-active,
.hero-fade-leave-active {
	transition: opacity 200ms ease;
}
.hero-fade-enter-from,
.hero-fade-leave-to {
	opacity: 0;
}
</style>
