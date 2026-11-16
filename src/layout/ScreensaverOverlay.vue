<script setup lang="ts">
import { computed } from 'vue';
import { screensaverStore } from '@/stores/screensaverStore';
import { playbackStore } from '@/stores/playbackStore';
import { buildImageUrl } from '@/lib/images/urls';

const active = screensaverStore.active;

const ambientArt = computed(() => {
	const t = playbackStore.music.track.value;

	if (!t?.cover)
		return null;

	return buildImageUrl(t.cover, { width: 1280, height: 1280 });
});
</script>

<template>
	<div v-if="active" class="screensaver">
		<div
			v-if="ambientArt"
			class="ambient"
			:style="{ backgroundImage: `url(${ambientArt})` }"
		/>
		<div class="dim" />
	</div>
</template>

<style scoped>
.screensaver {
	position: fixed;
	inset: 0;
	z-index: 1000;
	pointer-events: none;
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
</style>
