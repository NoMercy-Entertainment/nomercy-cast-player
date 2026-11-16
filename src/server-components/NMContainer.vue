<script setup lang="ts">
import Resolver from './Resolver.vue';
import { computed } from 'vue';
import { CONTAINER_TYPES } from './types';
import type { NMContainerWrapper, Update } from './types';

const props = defineProps<{
	id: string;
	data: NMContainerWrapper;
	update?: Update;
}>();

// Cards sit side by side like app-web's NMContainer; nested sections stack.
const stacksSections = computed(() => props.data.items?.some((item) => CONTAINER_TYPES.has(item.component)) ?? false);
</script>

<template>
	<section v-if="data.items?.length" class="container-section" :data-container-id="id">
		<header v-if="data.title" class="container-header">
			<h2>{{ data.title }}</h2>
		</header>
		<div :class="stacksSections ? 'container-stack' : 'container-row'">
			<Resolver v-for="item in data.items" :key="item.id" :component="item" />
		</div>
	</section>
</template>

<style scoped>
.container-section {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.container-stack {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.container-row {
	display: flex;
	flex-direction: row;
	gap: 16px;
	padding: 16px 8px;
}
.container-header {
	padding: 0 8px;
}
.container-header h2 {
	margin: 0;
	font-size: 28px;
	font-weight: 700;
}
</style>
