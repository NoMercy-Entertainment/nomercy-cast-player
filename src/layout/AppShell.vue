<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import Backdrop from './Backdrop.vue';
import TopNavBar from './TopNavBar.vue';

/**
 * Outermost shell — backdrop, topnav, RouterView with KeepAlive cache.
 *
 * Topnav is hidden on routes that own the full screen (now-playing,
 * profile sub-pages, settings, about, server-info). Mirrors APK
 * SharedMainScreen.kt's TvNavigationBar visibility — the navbar only
 * shows on home / libraries / library / music / search / info / person.
 */

const route = useRoute();
const HIDE_NAV_ROUTES = new Set([
	'now-playing',
	'profile',
	'profile-settings',
	'profile-about',
	'profile-server-info',
]);

const showNav = computed(() => {
	const name = typeof route.name === 'string'
		? route.name
		: '';

	if (!name)
		return true;

	return !HIDE_NAV_ROUTES.has(name);
});
</script>

<template>
	<div class="app-shell">
		<Backdrop />
		<TopNavBar v-if="showNav" />
		<main class="page">
			<RouterView v-slot="{ Component }">
				<KeepAlive :max="6">
					<component :is="Component" />
				</KeepAlive>
			</RouterView>
		</main>
	</div>
</template>

<style scoped>
.app-shell {
	position: relative;
	width: 100%;
	height: 100%;
}
.page {
	position: absolute;
	inset: 0;
	z-index: 1;
	overflow: hidden;
}
</style>
