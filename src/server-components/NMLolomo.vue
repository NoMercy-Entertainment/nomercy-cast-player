<script setup lang="ts">
import Resolver from './Resolver.vue';
import type { NMLolomoWrapper, Update } from './types';

// Drawn the same as NMContainer per spec §11 nm-lolomo.md: its items are
// NMCarousel envelopes.
defineProps<{
	id: string;
	data: NMLolomoWrapper;
	update?: Update;
}>();
</script>

<template>
	<section v-if="data.items?.length" class="container-section" :data-container-id="id">
		<header v-if="data.title" class="container-header">
			<h2>{{ data.title }}</h2>
		</header>
		<Resolver v-for="item in data.items" :key="item.id" :component="item" />
	</section>
</template>

<style scoped>
.container-section {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.container-header {
	padding: 0 var(--tv-safe-padding);
}
.container-header h2 {
	margin: 0;
	font-size: 28px;
	font-weight: 700;
}
</style>
