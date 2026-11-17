<script setup lang="ts">
import { ref } from 'vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';

/*
 * APK SearchKeyboard.KeyButton — square key with focus border + 1.06 scale,
 * surface background, mode keys highlight when active. Wide keys span 2 cols
 * via parent grid.
 */

const props = defineProps<{
	focusKey: string;
	label: string;
	icon?: string;
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
		<MoooomIcon v-if="icon" :icon="icon" />
		<template v-else>
			{{ label }}
		</template>
	</button>
</template>

<style scoped>
.key {
	font: inherit;
	border: 2px solid transparent;
	cursor: pointer;
	background: var(--cast-bg-base);
	color: var(--color-text-primary);
	font-weight: 400;
	font-size: 22px;
	line-height: 28px;
	letter-spacing: 0;
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
.key-mode,
.key-mode-active {
	font-size: 24px;
}
.key-mode-active {
	background: var(--color-primary, oklch(0.7 0.2 285));
	color: var(--cast-text-primary);
}
.key:focus-visible {
	transform: scale(1.06);
	border-color: var(--cast-text-primary);
	outline: none;
	z-index: 1;
}
</style>
