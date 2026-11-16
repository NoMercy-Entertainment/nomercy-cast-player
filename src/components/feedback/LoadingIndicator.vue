<script setup lang="ts">
import { useTranslation } from 'i18next-vue';

/*
 * Centered spinner. Mirrors APK LoadingIndicator.kt's CircularProgressIndicator.
 */
const { t } = useTranslation();
</script>

<template>
	<div class="loader" role="progressbar" :aria-label="t('common.loading')">
		<div class="ring" />
	</div>
</template>

<style scoped>
.loader {
	position: absolute;
	inset: 0;
	display: grid;
	place-items: center;
	z-index: 1;
}
.ring {
	width: 50px;
	height: 50px;
	border-radius: 50%;
	border: 4px solid rgba(255, 255, 255, 0.18);
	border-top-color: var(--cast-white);
	animation: spin 1s linear infinite;
}
@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
