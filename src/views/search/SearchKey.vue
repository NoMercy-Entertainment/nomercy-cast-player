<script setup lang="ts">
import { ref } from 'vue';
import { useFocusEntry } from '@/composables/useFocusEntry';

/*
 * APK SearchKeyboard.KeyButton — square key with focus border + 1.06 scale,
 * surface background, mode keys highlight when active. Wide keys span 2 cols
 * via parent grid.
 */

const props = defineProps<{
	focusKey: string;
	label: string;
	variant?: 'letter' | 'number' | 'hot' | 'mode' | 'mode-active';
}>();

const emit = defineEmits<{ press: [key: string] }>();

const el = ref<HTMLElement | null>(null);

useFocusEntry({
	key: props.focusKey,
	el,
	onAction: () => emit('press', props.label),
});
</script>

<template>
	<button
		ref="el"
		type="button"
		class="key"
		:class="[`key-${variant ?? 'letter'}`]"
		data-focusable
		tabindex="0"
	>
		{{ label }}
	</button>
</template>

<style scoped>
.key {
	font: inherit;
	border: 2px solid transparent;
	cursor: pointer;
	background: oklch(0.22 0.01 250);
	color: var(--color-text-primary);
	font-weight: 600;
	font-size: 16px;
	border-radius: 6px;
	aspect-ratio: 1 / 1;
	min-height: 0;
	min-width: 0;
	padding: 0;
	outline: none;
	transition:
		background var(--motion-fast),
		transform var(--motion-fast),
		border-color var(--motion-fast);
	display: grid;
	place-items: center;
}
.key-hot {
	background: oklch(0.18 0.02 250);
}
.key-number {
	background: oklch(0.18 0.02 250);
}
.key-mode {
	background: oklch(0.22 0.01 250);
	font-size: 24px;
}
.key-mode-active {
	background: var(--color-primary, oklch(0.7 0.2 285));
	color: oklch(0.18 0.02 35);
	font-size: 24px;
}
.key:focus-visible {
	transform: scale(1.06);
	border-color: oklch(0.95 0 0);
	outline: none;
	z-index: 1;
}
</style>
