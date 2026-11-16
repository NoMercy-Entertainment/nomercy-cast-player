<script setup lang="ts">
import { computed, ref } from 'vue';

/**
 * Single fixed blurred-art backdrop per spec §5 perf rule #11. Swaps on
 * focus-driven art changes; never paints multiple stacked blurred layers.
 *
 * Phase 4 wires the static brand gradient. Phase 5+ swaps it on
 * focus-into-card via a focusStore subscription.
 */
const currentImage = ref<string | null>(null);
const hasImage = computed(() => Boolean(currentImage.value));

defineExpose({ currentImage });
</script>

<template>
	<div class="backdrop">
		<div v-if="!hasImage" class="brand-gradient" />
		<img v-else
			:src="currentImage!"
			alt=""
			class="art"
			decoding="async"
		>
		<div class="scrim" />
	</div>
</template>

<style scoped>
.backdrop {
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
}
.brand-gradient {
	position: absolute;
	inset: 0;
}
.art {
	position: absolute;
	inset: -10%;
	width: 120%;
	height: 120%;
	object-fit: cover;
	filter: blur(var(--backdrop-blur)) brightness(0.5);
	transition: opacity 600ms ease-out;
}
.scrim {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, transparent 0%, oklch(0 0 0 / 0.4) 100%);
}
</style>
