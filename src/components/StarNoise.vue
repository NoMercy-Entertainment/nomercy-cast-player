<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { starNoiseTile } from '@/lib/starNoise';

// PosterBackground.kt:260-272: one 256 px tile, repeated, at a dim alpha.
const TILE = 256;
const url = ref('');

onMounted(() => {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');

	canvas.width = TILE;
	canvas.height = TILE;

	if (!context) return;

	context.putImageData(new ImageData(starNoiseTile(TILE), TILE, TILE), 0, 0);
	url.value = canvas.toDataURL();
});
</script>

<template>
	<div
		class="star-noise"
		aria-hidden="true"
		:style="url ? { backgroundImage: `url(${url})` } : undefined"
	/>
</template>

<style scoped>
.star-noise {
	position: absolute;
	inset: 0;
	pointer-events: none;
	background-repeat: repeat;
}
</style>
