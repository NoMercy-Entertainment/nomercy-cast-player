<script setup lang="ts">
import splash from '@/assets/splash.png';

/*
 * Shared full-bleed branded backdrop for setup-adjacent screens
 * (login, ready-to-cast, sender-required, profile, settings, server
 * info, about). Mirrors APK components/SetupBackdrop.kt landscape
 * branch — splash asset at 0.80 alpha behind a purple-tinted radial
 * vignette so foreground text/cards stay legible.
 *
 * Drop as the first child of a fill-parent positioned wrapper:
 *   <SetupBackdrop />
 *   <!-- content on top -->
 */
</script>

<template>
	<div class="setup-backdrop" aria-hidden="true">
		<img :src="splash" alt="" class="setup-image">
		<div class="setup-scrim" />
	</div>
</template>

<style scoped>
.setup-backdrop {
	position: absolute;
	inset: 0;
	pointer-events: none;
	overflow: hidden;
	background: var(--cast-black);
}
.setup-image {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	opacity: 0.8;
}
.setup-scrim {
	position: absolute;
	inset: 0;
	background: radial-gradient(ellipse 85% 85% at 50% 50%, transparent 0%, rgba(13, 0, 19, 0.72) 100%);
}
</style>
