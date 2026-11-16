<script setup lang="ts">
import { computed } from 'vue';
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

const backdropUrl = computed(() =>
	buildImageUrl(props.card.backdrop ?? props.card.poster ?? null, BACKDROP_SIZE),
);

const logoUrl = computed(() => buildImageUrl(props.card.logo ?? null, { width: 600 }));

const transitionKey = computed(() => props.card.id ?? props.card.title ?? '');
</script>

<template>
	<section class="hero">
		<Transition name="hero-fade" mode="out-in">
			<div :key="transitionKey" class="art">
				<img
					v-if="backdropUrl"
					class="nm-cover-top"
					:src="backdropUrl"
					:alt="card.title ?? ''"
					loading="eager"
					decoding="async"
				>
				<div class="nm-hero-scrim" />
			</div>
		</Transition>

		<Transition name="hero-fade" mode="out-in">
			<div :key="transitionKey" class="content">
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
				<p v-if="card.overview" class="nm-hero-overview">
					{{ card.overview }}
				</p>
			</div>
		</Transition>
	</section>
</template>

<style scoped>
.hero {
	position: relative;
	width: 100%;
	height: 62vh;
	overflow: hidden;
	background: oklch(0.12 0.01 250);
}
.art {
	position: absolute;
	inset: 0;
}
.content {
	position: absolute;
	inset: 0;
	width: 60%;
	/* Below the nav and above the rails that reach up into the hero. */
	padding: var(--topnav-height) 16px calc(var(--hero-rails-overlap) + 16px) 40px;
	color: #fff;
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 18px;
}
/* KMP TV hero sizes (58 dp logo, 5 lines of 14/20): they fit between the nav and the rails at 540 px. */
.nm-hero-logo {
	max-height: 58px;
}
.nm-hero-overview {
	font-size: 14px;
	line-height: 20px;
	-webkit-line-clamp: 5;
}

.hero-fade-enter-active,
.hero-fade-leave-active {
	transition: opacity 360ms ease;
}
.hero-fade-enter-from,
.hero-fade-leave-to {
	opacity: 0;
}
</style>
