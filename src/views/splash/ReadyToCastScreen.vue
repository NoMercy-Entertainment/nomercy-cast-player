<script setup lang="ts">
import { computed } from 'vue';
import { authStore } from '@/stores/authStore';
import { socketStore } from '@/stores/socketStore';
import { closeCastSession } from '@/cast/receiver';
import { useFocusGroup } from '@/composables/useFocusGroup';
import FocusableButton from '@/components/buttons/FocusableButton.vue';
import logoWide from '@/assets/logo-wide.svg';
import mobile from '@/assets/mobile.svg';
import splash from '@/assets/splash.png';

/**
 * Splash screen styled to match the original cast-player aesthetic so
 * the receiver shares visual language with sender apps. Wired to
 * authStore + socketStore reactive state.
 *
 * Also the page a TV lands on when the native app launch was refused and
 * cast_shell fell back to this web receiver with no sender attached —
 * that case needs a focused control and a way back, not just a message.
 */

useFocusGroup({
	type: 'modal',
	onEscape: () => {
		closeCastSession();
		return true;
	},
});

const status = computed(() => {
	switch (authStore.receiverState.value) {
		case 'LOADING':
			return 'Connecting…';
		case 'AUTHED':
			return 'Connecting to your server…';
		case 'CONNECTING':
			return 'Connecting to your server…';
		case 'READY':
			return 'Ready to cast';
		case 'TEARDOWN':
			return 'Closing';
		default:
			return 'Ready to cast';
	}
});

const userName = computed(() => {
	const claims = authStore.userClaims.value;
	if (!claims)
		return '';
	return (claims.display_name as string) ?? (claims.preferred_username as string) ?? '';
});

const isConnected = computed(() => socketStore.connectionState.value === 'connected');
const isPulsing = computed(() => !isConnected.value);
</script>

<template>
	<main class="splash">
		<img class="bg" :src="splash" alt="" aria-hidden="true">

		<section class="content">
			<div class="status-row">
				<h1 class="status-text" :class="[{ pulse: isPulsing }]">
					{{ status }}
				</h1>
				<div
					v-if="isConnected"
					class="dot"
					title="Connected"
				/>
			</div>

			<p class="instructions">
				<template v-if="userName">
					<span>Hi <strong>{{ userName }}</strong>, to start casting tap the</span>
					<br>
					<span class="emphasis">Chromecast</span>
					<span> button in the NoMercy app.</span>
				</template>
				<template v-else>
					<span>To start casting audio or video tap the</span>
					<br>
					<span class="emphasis">Chromecast</span>
					<span> button in the MediaPlayer or App.</span>
				</template>
			</p>

			<FocusableButton
				focus-key="splash-close"
				variant="ghost"
				@action="closeCastSession"
			>
				Close
			</FocusableButton>
		</section>

		<img class="phone" :src="mobile" alt="" aria-hidden="true">

		<img class="brand" :src="logoWide" alt="NoMercy">
	</main>
</template>

<style scoped>
.splash {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	position: relative;
	overflow: hidden;
	background: linear-gradient(180deg, #232323, #161616);
	padding: 45px 100px;
}

.bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: auto;
	aspect-ratio: 16 / 9;
	object-fit: cover;
	pointer-events: none;
}

.content {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 16px;
	width: 625px;
	z-index: 1;
}

.status-row {
	display: flex;
	align-items: center;
	gap: 16px;
}

.status-text {
	margin: 0;
	font-size: 40px;
	font-weight: 900;
	color: #ededed;
	line-height: 1;
}

.status-text.pulse {
	animation: pulse 2s ease-in-out infinite;
}

.dot {
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: oklch(0.7 0.15 145);
	animation: pulse 2s ease-in-out infinite;
}

.instructions {
	margin: 0;
	font-size: 20px;
	color: #ededed;
	line-height: 1.4;
}

.emphasis {
	font-weight: 700;
}

.phone {
	position: relative;
	width: 240px;
	height: 268px;
	z-index: 1;
}

.brand {
	position: relative;
	height: 48px;
	width: max-content;
	z-index: 1;
}

@keyframes pulse {
	0%,
	100% {
		opacity: 0.7;
	}

	50% {
		opacity: 1;
	}
}
</style>
