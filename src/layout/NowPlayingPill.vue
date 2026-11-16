<script setup lang="ts">
import { socketStore } from '@/stores/socketStore';
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';

const { t } = useTranslation();
const stateLabel = computed(() => {
	switch (socketStore.connectionState.value) {
		case 'connecting':
			return t('cast_remote.connecting');
		case 'reconnecting':
			return t('layout.connection.reconnecting');
		case 'connected':
			return t('activity.connection.connected');
		case 'failed':
			return t('activity.connection.disconnected');
		default:
			return '';
	}
});

const isReconnecting = computed(() =>
	['connecting', 'reconnecting'].includes(socketStore.connectionState.value),
);
</script>

<template>
	<div v-if="stateLabel" class="pill" :class="[{ reconnecting: isReconnecting }]">
		<span class="dot" />
		{{ stateLabel }}
	</div>
</template>

<style scoped>
.pill {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 6px 16px;
	background: oklch(1 0 0 / 0.08);
	border-radius: 999px;
	font-size: 13px;
	color: var(--color-text-secondary);
}
.dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: oklch(0.7 0.15 145);
}
.reconnecting .dot {
	background: oklch(0.7 0.18 70);
}
</style>
