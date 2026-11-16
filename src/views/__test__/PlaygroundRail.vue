<script setup lang="ts">
import { ref } from 'vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import PlaygroundCard from './PlaygroundCard.vue';

const props = defineProps<{
	rowId: string;
	onAction: (line: string) => void;
}>();

const railEl = ref<HTMLElement | null>(null);

useFocusGroup({
	type: 'horizontal',
	restorationKey: `playground-${props.rowId}`,
	containerEl: railEl,
});

const cards = Array.from({ length: 8 }, (_, i) => i);
</script>

<template>
	<section class="rail">
		<header><h2>{{ rowId }}</h2></header>
		<div ref="railEl" class="rail-track">
			<PlaygroundCard
				v-for="i in cards"
				:key="i"
				:row-id="rowId"
				:idx="i"
				:on-action="onAction"
			/>
		</div>
	</section>
</template>

<style scoped>
.rail {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.rail-track {
	display: flex;
	gap: 16px;
	overflow-x: auto;
	padding-block: 16px;
}
</style>
