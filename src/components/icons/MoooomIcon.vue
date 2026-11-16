<script lang="ts" setup>
import { computed } from 'vue';
import { moooomIcons } from 'virtual:moooom-icons';

const props = defineProps<{ icon: string }>();

const drawing = computed(() => moooomIcons[props.icon] ?? null);
</script>

<template>
	<svg
		v-if="drawing"
		class="moooom-icon"
		width="24"
		height="24"
		:data-icon="icon"
		:viewBox="drawing.viewBox"
		:fill="drawing.fill"
		aria-hidden="true"
		focusable="false"
		v-html="drawing.body"
	/>
	<svg
		v-else
		class="moooom-icon"
		width="24"
		height="24"
		:data-icon="icon"
		viewBox="0 0 24 24"
		aria-hidden="true"
		focusable="false"
	/>
</template>

<style>
:where(.moooom-icon) {
	display: block;
	flex: none;
	pointer-events: none;
}
</style>
