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
	width: 24px;
	height: 24px;
	pointer-events: none;
}
</style>
