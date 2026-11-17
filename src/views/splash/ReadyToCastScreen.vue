<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { authStore } from '@/stores/authStore';
import { socketStore } from '@/stores/socketStore';
import { closeCastSession, connectedSenders } from '@/cast/receiver';
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
 * cast_shell fell back here with no sender attached: only then is Close shown.
 * Back closes the session in every state.
 */

useFocusGroup({
	type: 'modal',
	onEscape: () => {
		closeCastSession();

		return true;
	},
});

const { t } = useTranslation();

const status = computed(() => {
	switch (authStore.receiverState.value) {
		case 'LOADING':
			// With no sender there is nothing to connect to yet.
			return connectedSenders.value === 0
				? t('views.splash.ready')
				: t('views.splash.connecting');
		case 'AUTHED':
			return t('views.splash.connecting_server');
		case 'CONNECTING':
			return t('views.splash.connecting_server');
		case 'READY':
			return t('views.splash.ready');
		case 'TEARDOWN':
			return t('views.splash.closing');
		default:
			return t('views.splash.ready');
	}
});

const userName = computed(() => {
	const claims = authStore.userClaims.value;

	if (!claims)
		return '';

	return (claims.display_name as string) ?? (claims.preferred_username as string) ?? '';
});

const isConnected = computed(() => socketStore.connectionState.value === 'connected');
const isPulsing = computed(() => !isConnected.value && connectedSenders.value > 0);
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
					:title="t('views.splash.connected')"
				/>
			</div>

			<p class="instructions">
				<template v-if="userName">
					<span>{{ t('views.splash.hi') }} <strong>{{ userName }}</strong>{{ t('views.splash.hi_rest') }}</span>
					<br>
					<span class="emphasis">{{ t('nav.chromecast') }}</span>
					<span> {{ t('views.splash.button_in_app') }}</span>
				</template>
				<template v-else>
					<span>{{ t('views.splash.no_user_start') }}</span>
					<br>
					<span class="emphasis">{{ t('nav.chromecast') }}</span>
					<span> {{ t('views.splash.button_in_player') }}</span>
				</template>
			</p>

			<FocusableButton
				v-if="connectedSenders === 0"
				class="close"
				focus-key="splash-close"
				variant="ghost"
				@action="closeCastSession"
			>
				{{ t('common.close') }}
			</FocusableButton>
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
	color: var(--nm-text-primary);
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
	color: var(--nm-text-primary);
	line-height: 1.4;
}

.emphasis {
	font-weight: 700;
}

/* Sized to its label, not stretched across the column. */
.close {
	align-self: flex-start;
	min-width: 160px;
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
