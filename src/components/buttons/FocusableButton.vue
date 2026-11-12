<script setup lang="ts">
import { ref } from 'vue';
import { useFocusEntry } from '@/composables/useFocusEntry';

const props = defineProps<{
	focusKey: string;
	variant?: 'primary' | 'ghost';
	disabled?: boolean;
}>();

const emit = defineEmits<{ action: [] }>();

const el = ref<HTMLElement | null>(null);

useFocusEntry({
	key: props.focusKey,
	el,
	onAction: () => {
		if (props.disabled)
			return;
		emit('action');
	},
});
</script>

<template>
	<button
		ref="el"
		type="button"
		class="fb" :class="[`fb-${variant ?? 'primary'}`, { 'fb-disabled': disabled }]"
		:disabled="disabled"
		data-focusable
	>
		<slot />
	</button>
</template>

<style scoped>
.fb {
	font: inherit;
	border: 0;
	cursor: pointer;
	border-radius: 999px;
	padding: 12px 24px;
	font-weight: 600;
	transition: transform var(--motion-fast);
}
.fb-primary {
	background: var(--color-accent);
	color: oklch(0.18 0.02 35);
}
.fb-ghost {
	background: oklch(1 0 0 / 0.08);
	color: var(--color-text-primary);
}
.fb-disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
.fb:focus-visible,
.fb:focus {
	/* tv-safe.css gives every focused [data-focusable] border-radius: inherit; a pill stays a pill. */
	border-radius: 999px;
	transform: scale(1.05);
	outline: var(--focus-ring-width) solid var(--focus-ring-color);
	outline-offset: var(--focus-ring-offset);
}
</style>
