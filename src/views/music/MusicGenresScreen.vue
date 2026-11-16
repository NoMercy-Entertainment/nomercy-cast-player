<script setup lang="ts">
import { useRoute } from 'vue-router';
import SetupBackdrop from '@/components/SetupBackdrop.vue';

/*
 * APK MusicGenreScreen.kt is currently a placeholder rendering
 * "MusicGenreScreen: $type / $id" over the setup backdrop. We mirror
 * that until the APK lands real content.
 */
const route = useRoute();
</script>

<template>
	<div class="music-genres">
		<SetupBackdrop />
		<p class="placeholder">
			MusicGenreScreen: {{ route.fullPath }}
		</p>
	</div>
</template>

<style scoped>
.music-genres {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	display: grid;
	place-items: center;
}
.placeholder {
	position: relative;
	z-index: 1;
	color: var(--cast-text-primary);
	font-size: 18px;
}
</style>
