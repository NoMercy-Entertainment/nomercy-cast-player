<script setup lang="ts">
import { ref } from 'vue';
import { useFocusEntry } from '@/composables/useFocusEntry';

const props = defineProps<{
	focusKey: string;
	label: string;
	path: string;
	active: boolean;
	iconOnly?: boolean;
	ariaLabel?: string;
}>();

const emit = defineEmits<{ action: [path: string] }>();

const el = ref<HTMLElement | null>(null);

useFocusEntry({
	key: props.focusKey,
	el,
	onAction: () => emit('action', props.path),
});
</script>

<template>
	<a
		ref="el"
		class="nav-link"
		:class="[{ active, 'icon-only': iconOnly }]"
		:href="path"
		:aria-label="ariaLabel ?? label"
		data-focusable
		tabindex="0"
		@click.prevent="emit('action', path)"
	>
		<span v-if="$slots.icon" class="icon">
			<slot name="icon" />
		</span>
		<span v-if="!iconOnly && label" class="label">{{ label }}</span>
		<slot />
	</a>
</template>

<style scoped>
.nav-link {
	display: inline-flex;
	align-items: center;
	position: relative;
	isolation: isolate;
	gap: 10px;
	padding: 4px 12px 4px 8px;
	height: auto;
	border-radius: 20px;
	font-size: 13px;
	font-weight: 400;
	color: var(--cast-text-primary);
	text-decoration: none;
	background: oklch(0 0 0 / 0.6);
	transition:
		background var(--motion-fast),
		box-shadow var(--motion-fast);
	border-radius: 20px;
}
/* TvNavigationBar.kt:303-318: 2 dp primary ring, 6 dp gap. A pseudo box keeps the radius on Chrome 92. */
.nav-link::after {
	content: '';
	position: absolute;
	inset: -6px;
	border: 2px solid transparent;
	border-radius: 24px;
	pointer-events: none;
	transition: border-color var(--motion-fast);
}
.nav-link.icon-only {
	width: 36px;
	padding: 4px 0;
	justify-content: center;
}
.nav-link.active {
	background: transparent;
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}
/* TvNavigationBar.kt:285-287: primary fading to primary at 80 % alpha. */
.nav-link.active::before {
	content: '';
	position: absolute;
	inset: 0;
	z-index: -1;
	border-radius: inherit;
	background: var(--color-primary, oklch(0.7 0.2 285));
	-webkit-mask-image: linear-gradient(90deg, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0.8));
}
.nav-link:focus-visible {
	outline: none;
}
.nav-link:focus-visible::after {
	border-color: var(--color-primary, oklch(0.7 0.2 285));
}
.icon {
	display: inline-grid;
	place-items: center;
	width: 20px;
	height: 20px;
	color: var(--cast-text-primary);
}
.label {
	line-height: 24px;
	letter-spacing: 0.5px;
}
</style>
