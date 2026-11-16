<script setup lang="ts">
import { ref } from 'vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import Resolver from './Resolver.vue';
import type { NMListWrapper, Update } from './types';

const props = defineProps<{
	id: string;
	data: NMListWrapper;
	update?: Update;
}>();

const containerEl = ref<HTMLElement | null>(null);
useFocusGroup({
	type: 'vertical',
	restorationKey: `list-${props.id}`,
	containerEl,
});
</script>

<template>
	<section v-if="props.data.items?.length" class="list-section" :data-list-id="id">
		<header v-if="props.data.title" class="list-header">
			<h2>{{ props.data.title }}</h2>
		</header>
		<div ref="containerEl" class="list-track">
			<Resolver v-for="item in props.data.items" :key="item.id" :component="item" />
		</div>
	</section>
</template>

<style scoped>
.list-section {
	display: flex;
	flex-direction: column;
	contain: layout paint;
}
.list-header {
	padding: 0 var(--tv-safe-padding);
}
.list-header h2 {
	margin: 0;
	font-size: 24px;
	font-weight: 600;
}
.list-track {
	display: flex;
	flex-direction: column;
	padding: 16px var(--tv-safe-padding);
	gap: 16px;
}
</style>
