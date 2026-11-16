<script setup lang="ts">
import FocusableButton from '@/components/buttons/FocusableButton.vue';

defineProps<{
	message: string;
	action?: { label: string; onAction: () => void };
}>();
</script>

<template>
	<div class="empty-state">
		<p class="empty-message">
			{{ message }}
		</p>
		<FocusableButton
			v-if="action"
			focus-key="empty-action"
			@action="action.onAction"
		>
			{{ action.label }}
		</FocusableButton>
	</div>
</template>

<style scoped>
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 12px;
	padding: 48px 40px;
	height: 100%;
}
.empty-message {
	font-size: 20px;
	line-height: 28px;
	text-align: center;
	color: var(--color-text-secondary);
	margin: 0;
}
</style>
