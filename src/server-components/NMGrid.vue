<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import Resolver from './Resolver.vue';
import type { NMGridWrapper, Update } from './types';

const props = defineProps<{
	id: string;
	data: NMGridWrapper;
	update?: Update;
}>();

const router = useRouter();
const containerEl = ref<HTMLElement | null>(null);
const moreLinkEl = ref<HTMLElement | null>(null);
const columns = (props.data.properties?.columns as number | undefined) ?? 6;

useFocusGroup({
	type: 'grid',
	restorationKey: `grid-${props.id}`,
	columns,
	containerEl,
});

useFocusEntry({
	key: `${props.id}-more`,
	el: moreLinkEl,
	onAction: () => {
		if (props.data.more_link)
			router.push(props.data.more_link);
	},
});
</script>

<template>
	<section v-if="props.data.items?.length" class="grid-section" :data-grid-id="id">
		<header v-if="props.data.title" class="grid-header">
			<h2>{{ props.data.title }}</h2>
			<button
				v-if="props.data.more_link"
				ref="moreLinkEl"
				class="more-link"
				type="button"
				data-focusable
				tabindex="0"
				@click.prevent="props.data.more_link && router.push(props.data.more_link)"
			>
				{{ props.data.more_link_text || 'More' }}
			</button>
		</header>

		<div ref="containerEl" class="grid-track" :style="{ '--cols': columns }">
			<Resolver v-for="item in props.data.items" :key="item.id" :component="item" />
		</div>
	</section>
</template>

<style scoped>
.grid-section {
	display: flex;
	flex-direction: column;
	contain: layout paint;
	padding-block-end: 32px;
}
.grid-header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	padding: 0 var(--tv-safe-padding);
}
.grid-header h2 {
	margin: 0;
	font-size: 24px;
	font-weight: 600;
}
.grid-track {
	display: grid;
	grid-template-columns: repeat(var(--cols), 1fr);
	gap: 16px;
	padding: 64px 20px 16px 16px;
}
.more-link {
	font-size: 14px;
	font-weight: 600;
	color: var(--color-text-secondary);
	background: transparent;
	border: 2px solid transparent;
	border-radius: 999px;
	padding: 6px 14px;
	cursor: pointer;
	outline: none;
	transition:
		color var(--motion-fast),
		border-color var(--motion-fast);
}
.more-link:focus-visible {
	color: var(--cast-text-primary);
	border-color: var(--color-primary, oklch(0.7 0.2 285));
}
</style>
