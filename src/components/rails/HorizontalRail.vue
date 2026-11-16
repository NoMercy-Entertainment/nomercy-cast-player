<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
	ariaLabel?: string;
}>();

const trackEl = ref<HTMLElement | null>(null);
defineExpose({ trackEl });
</script>

<template>
	<div
		ref="trackEl"
		class="rail-track nm-no-scrollbar"
		:aria-label="ariaLabel"
		role="list"
	>
		<slot />
	</div>
</template>

<style scoped>
.rail-track {
	display: flex;
	gap: var(--rail-card-gap);
	overflow-x: auto;
	overflow-y: visible;
	/* item_tv_row.xml: 40 dp each side; 2 px above and below keep the focus ring unclipped. */
	padding: 2px 40px;
	scroll-padding-inline: 40px;
	scroll-behavior: smooth;
}
/* No card drawn yet: keep one card row of room so the rails below stay put. */
.rail-track:empty {
	min-height: calc(var(--rail-card-height) + 4px);
}
</style>
