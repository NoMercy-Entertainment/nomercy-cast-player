<script setup lang="ts">
import logoWide from '@/assets/logo-wide.svg';
import mobile from '@/assets/mobile.svg';
import splash from '@/assets/splash.png';
import FocusableButton from '@/components/buttons/FocusableButton.vue';
import { useFocusGroup } from '@/composables/useFocusGroup';

/**
 * DEGRADED-state splash per spec §3.2 + §8.5. Same composition as
 * ReadyToCastScreen so the receiver's visual identity holds across
 * states — only the messaging changes. Refresh failure → "Re-cast
 * from your phone to continue." Receiver doesn't auto-end the
 * session; cast_shell decides when to unload.
 *
 * With `title`, `message` and `retry` it is the cast-again screen: the same
 * composition with one D-pad action.
 */

defineProps<{
	title?: string;
	message?: string;
	retry?: () => void;
}>();

useFocusGroup({ type: 'modal', initialFocusKey: 'cast-again-retry' });
</script>

<template>
	<main class="splash">
		<img class="bg" :src="splash" alt="" aria-hidden="true">

		<section class="content">
			<div class="status-row">
				<h1 class="status-text pulse">
					{{ title ?? 'Re-cast from your phone' }}
				</h1>
			</div>

			<p v-if="message" class="instructions">
				{{ message }}
			</p>
			<p v-else class="instructions">
				<span>Your cast session expired. Open NoMercy on your phone or desktop and tap the</span>
				<br>
				<span class="emphasis">Chromecast</span>
				<span> button to continue.</span>
			</p>

			<div v-if="retry" class="actions">
				<FocusableButton focus-key="cast-again-retry" @action="retry">
					Try again
				</FocusableButton>
			</div>
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
	opacity: 0.6;
}

.content {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 16px;
	width: 720px;
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

.pulse {
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

.actions {
	display: flex;
	margin-top: 16px;
	font-size: 20px;
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
