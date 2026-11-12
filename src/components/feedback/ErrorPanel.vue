<script setup lang="ts">
import FocusableButton from '@/components/buttons/FocusableButton.vue';
import { useFocusGroup } from '@/composables/useFocusGroup';

defineProps<{
	error: Error | { message: string };
	retry?: () => void;
	context?: string;
}>();

// The panel owns its focus group, so its action takes D-pad focus on every screen.
useFocusGroup({ type: 'vertical', initialFocusKey: 'error-retry' });
</script>

<template>
	<div class="error-panel">
		<h3 class="error-title">
			{{ context ?? 'Something went wrong' }}
		</h3>
		<p class="error-message">
			{{ error.message }}
		</p>
		<FocusableButton v-if="retry" focus-key="error-retry" @action="retry">
			Try again
		</FocusableButton>
	</div>
</template>

<style scoped>
.error-panel {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16px;
	padding: 48px;
	text-align: center;
}
.error-title {
	font-size: 24px;
	font-weight: 600;
	color: var(--color-text-primary);
	margin: 0;
}
.error-message {
	font-size: 16px;
	color: var(--color-text-secondary);
	margin: 0;
	max-width: 60ch;
}
</style>
