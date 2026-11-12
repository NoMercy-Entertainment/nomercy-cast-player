<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authStore } from '@/stores/authStore';
import { useDPad } from '@/composables/useDPad';
import { screensaverStore } from '@/stores/screensaverStore';
import SenderRequiredScreen from '@/views/splash/SenderRequiredScreen.vue';
import ScreensaverOverlay from '@/layout/ScreensaverOverlay.vue';
import MusicPlayer from '@/players/music/MusicPlayer.vue';

/**
 * Root layout. Phase 1 only renders splash routes via <RouterView>;
 * Phase 4 introduces AppShell with backdrop + topnav + KeepAlive cache.
 *
 * useDPad is mounted here so the global keydown handler is alive for the
 * entire receiver session. The handler dispatches to the top-of-stack
 * FocusGroup; groups register/unregister themselves via the focusStore
 * stack as routes mount.
 *
 * DEGRADED state preempts whatever route is active — refresh failure
 * means we cannot reach server APIs, so the only useful screen is the
 * sender-required splash.
 */

const router = useRouter();
useDPad(router);

const inDegraded = computed(() => authStore.receiverState.value === 'DEGRADED');
// Preempts every route, video and music alike, like DEGRADED above.
const castAgain = computed(() => authStore.castAgainRequired.value);

onMounted(() => {
	// Kick off the idle timer so the screensaver can fire the first time
	// even if no key has been pressed yet (long-running cast sessions
	// sometimes never see initial input).
	screensaverStore.resetIdle();

	document.addEventListener('visibilitychange', () => {
		console.debug('[app] visibilitychange', document.visibilityState);
		// Reset idle on resume so the overlay doesn't pop instantly when
		// cast_shell unsuspends us.
		if (document.visibilityState === 'visible')
			screensaverStore.resetIdle();
	});
});
</script>

<template>
	<SenderRequiredScreen v-if="inDegraded" />
	<SenderRequiredScreen
		v-else-if="castAgain"
		title="Cast again to keep watching"
		message="Your sign-in on this TV is ending. Cast again from your phone to keep watching."
		:retry="authStore.requestRenewal"
	/>
	<MusicPlayer v-else>
		<RouterView />
	</MusicPlayer>
	<ScreensaverOverlay />
</template>
