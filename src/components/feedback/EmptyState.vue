<script setup lang="ts">
import FocusableButton from '@/components/buttons/FocusableButton.vue';

defineProps<{
	message: string;
	action?: { label: string; onAction: () => void };
}>();
</script>

<template>
	<div class="empty-state">
		<svg
			class="empty-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 11v5M12 8h.01" />
		</svg>
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
.empty-icon {
	width: 48px;
	height: 48px;
	flex: none;
	color: var(--color-text-secondary);
}
.empty-message {
	font-size: 20px;
	line-height: 28px;
	text-align: center;
	color: var(--color-text-secondary);
	margin: 0;
}
</style>
