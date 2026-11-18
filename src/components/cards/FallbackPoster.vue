<script setup lang="ts">
import AppLogoSquare from '@/layout/AppLogoSquare.vue';

defineProps<{
	title?: string;
}>();
</script>

<template>
	<div class="fallback-poster" role="img" :aria-label="title">
		<AppLogoSquare class="mark" />
	</div>
</template>

<style scoped>
.fallback-poster {
	width: 100%;
	height: 100%;
	display: grid;
	place-items: center;
	background: var(--cast-black);
	border-radius: var(--radius-card);
}
.mark {
	width: 60%;
	height: 60%;
}
</style>
