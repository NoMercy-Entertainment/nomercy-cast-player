<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
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

const { t } = useTranslation();

useFocusGroup({ type: 'modal', initialFocusKey: 'cast-again-retry' });
</script>

<template>
	<main class="splash">
		<img class="bg" :src="splash" alt="" aria-hidden="true">

		<section class="content">
			<div class="status-row">
				<h1 class="status-text pulse">
					{{ title ?? t('views.splash.recast') }}
				</h1>
			</div>

			<p v-if="message" class="instructions">
				{{ message }}
			</p>
			<p v-else class="instructions">
				<span>{{ t('views.splash.expired') }}</span>
				<br>
				<span class="emphasis">{{ t('nav.chromecast') }}</span>
				<span> {{ t('views.splash.button_to_continue') }}</span>
			</p>

			<div v-if="retry" class="actions">
				<FocusableButton focus-key="cast-again-retry" @action="retry">
					{{ t('startup.tryAgain') }}
				</FocusableButton>
			</div>
		</section>

		<img class="phone" :src="mobile" alt="" aria-hidden="true">

		<img class="brand" :src="logoWide" :alt="t('common.app_name')">
	</main>
</template>

<style scoped>
.splash {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 24px;
	position: relative;
	overflow: hidden;
	background: linear-gradient(180deg, var(--nm-gray-3), var(--nm-surface));
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
	color: var(--nm-text-primary);
	line-height: 1;
}

.pulse {
	animation: pulse 2s ease-in-out infinite;
}

.instructions {
	margin: 0;
	font-size: 20px;
	color: var(--nm-text-primary);
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
	flex: 0 1 268px;
	min-height: 0;
	width: auto;
	aspect-ratio: 240 / 268;
	align-self: flex-start;
	z-index: 1;
}

/* A short screen has no room for the drawing next to the text and the logo. */
@media (max-height: 600px) {
	.phone {
		display: none;
	}
}

.brand {
	position: relative;
	height: 48px;
	width: auto;
	align-self: flex-start;
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
