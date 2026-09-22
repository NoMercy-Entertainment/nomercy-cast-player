<script setup lang="ts">
import type { Update } from './types';

/**
 * A plugin's own words, on the receiver.
 *
 * Without this every string a plugin sent reached the resolver as an unknown
 * component and drew nothing, so a panel of labels arrived on the television
 * as empty space while the same payload read correctly in a browser.
 */
defineProps<{
	id: string;
	data: { text?: string; variant?: string };
	update?: Update;
}>();
</script>

<template>
	<span v-if="data.text" class="text" :class="data.variant" :data-text-id="id">{{ data.text }}</span>
</template>

<style scoped>
.text {
	font-size: 24px;
	line-height: 1.4;
	color: var(--color-text, oklch(0.95 0 0));
}

.heading {
	font-size: 32px;
	font-weight: 700;
}

.muted {
	color: var(--color-text-muted, oklch(0.7 0 0));
}
</style>
