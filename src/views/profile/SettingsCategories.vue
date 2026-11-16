<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { FocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { focusTopnav } from '@/composables/useNavFocusBridge';

/*
 * AppSettingsScreen.kt:528-554: the left pane. OK opens a category; focus
 * alone does not. UP and DOWN stay in the list, RIGHT goes to the rows.
 */
const props = defineProps<{
	items: Array<{ key: string; label: string }>;
	selected: string;
}>();

const emit = defineEmits<{ select: [string] }>();

const itemEls = ref<HTMLElement[]>([]);

const group = useFocusGroup({
	type: 'vertical',
	restorationKey: 'settings-categories',
	onEscape: (dir) => {
		if (dir === 'up')
			return focusTopnav();

		return dir !== 'right';
	},
});

const releases: Array<() => void> = [];

onMounted(() => {
	props.items.forEach((item, index) => {
		const el = itemEls.value[index];

		if (!el) return;

		const entry: FocusEntry = {
			key: `category-${item.key}`,
			order: index,
			enabled: true,
			el: () => el,
			isFocused: () => document.activeElement === el,
			focus: () => el.focus({ preventScroll: true }),
			blur: () => el.blur(),
			action: () => emit('select', item.key),
		};

		releases.push(group.register(entry));
	});
});

onBeforeUnmount(() => releases.forEach((release) => release()));

defineExpose({ focusSelected: () => group.focusByKey(`category-${props.selected}`) });
</script>

<template>
	<div class="category-list" role="tablist" aria-orientation="vertical">
		<button
			v-for="item in props.items"
			:key="item.key"
			ref="itemEls"
			class="category-item"
			:class="[{ selected: item.key === props.selected }]"
			type="button"
			role="tab"
			data-focusable
			tabindex="0"
			:aria-selected="item.key === props.selected"
			@click.prevent="emit('select', item.key)"
		>
			{{ item.label }}
		</button>
	</div>
</template>

<style scoped>
.category-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.category-item {
	position: relative;
	box-sizing: border-box;
	width: 100%;
	padding: 14px 20px;
	border: 0;
	border-radius: 10px;
	background: transparent;
	color: rgba(255, 255, 255, 0.7);
	font-family: inherit;
	font-size: 16px;
	font-weight: 500;
	text-align: left;
	outline: none;
	cursor: pointer;
}
.category-item::before {
	content: '';
	position: absolute;
	inset: 0;
	border-radius: 10px;
	background: var(--color-primary, oklch(0.7 0.2 285));
	opacity: 0;
}
.category-item.selected {
	color: var(--cast-text-primary);
	font-weight: 600;
}
.category-item.selected::before {
	opacity: 0.25;
}
.category-item:focus-visible {
	color: var(--cast-text-primary);
	box-shadow: inset 0 0 0 3px var(--cast-white);
}
.category-item.selected:focus-visible::before {
	opacity: 0.45;
}
</style>
