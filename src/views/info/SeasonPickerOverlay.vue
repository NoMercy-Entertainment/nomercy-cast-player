<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { FocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { focusStore } from '@/stores/focusStore';

/*
 * TvSeasonPickerOverlay.kt:74-156: a panel of season rows under the hero.
 * UP and DOWN move between rows, OK selects, Back closes.
 */
const props = defineProps<{
	options: Array<{ number: number; label: string }>;
	selected: number | null;
}>();

const emit = defineEmits<{ select: [number]; close: [] }>();

const rowEls = ref<HTMLElement[]>([]);

const group = useFocusGroup({
	type: 'modal',
	autoFocus: false,
	onEscape: (dir) => {
		if (dir === 'back')
			emit('close');
		return true;
	},
});

const releases: Array<() => void> = [];

// The rows live in a v-for, so each registers by hand on this group.
onMounted(() => {
	props.options.forEach((option, index) => {
		const el = rowEls.value[index];
		if (!el)
			return;
		const entry: FocusEntry = {
			key: `season-${option.number}`,
			order: index,
			enabled: true,
			el: () => el,
			isFocused: () => document.activeElement === el,
			focus: () => {
				el.focus({ preventScroll: true });
				el.scrollIntoView({ block: 'nearest' });
			},
			blur: () => el.blur(),
			action: () => emit('select', option.number),
		};
		releases.push(group.register(entry));
		releases.push(focusStore.registerAction(el, entry.action));
	});
	void nextTick(() => {
		const current = props.options.findIndex(o => o.number === props.selected);
		rowEls.value[Math.max(current, 0)]?.focus();
	});
});

onBeforeUnmount(() => releases.forEach(release => release()));
</script>

<template>
	<Teleport to="body">
		<div class="season-scrim">
			<div class="season-overlay season-panel" role="listbox" aria-label="Season">
				<button
					v-for="option in props.options"
					:key="option.number"
					ref="rowEls"
					class="season-row"
					type="button"
					role="option"
					data-focusable
					tabindex="0"
					:aria-selected="option.number === props.selected"
					@click="emit('select', option.number)"
				>
					<span>{{ option.label }}</span>
					<svg
						v-if="option.number === props.selected"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M5 12l5 5L20 7" />
					</svg>
				</button>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.season-scrim {
	position: fixed;
	inset: 0;
	z-index: 150;
	background: rgba(0, 0, 0, 0.55);
}
.season-panel {
	display: flex;
	flex-direction: column;
	gap: 4px;
	box-sizing: border-box;
	width: 360px;
	max-height: 520px;
	overflow-y: auto;
	margin-left: 40px;
	margin-top: var(--hero-height);
	padding: 6px;
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 12px;
	background: #1a1a1a;
}
.season-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	box-sizing: border-box;
	padding: 12px 14px;
	border: 1px solid transparent;
	border-radius: 8px;
	background: transparent;
	color: #fff;
	font-size: 15px;
	font-weight: 400;
	text-align: left;
	outline: none;
	cursor: pointer;
}
.season-row[aria-selected='true'] {
	border-color: rgba(255, 255, 255, 0.35);
	font-weight: 600;
}
.season-row:focus-visible {
	border: 2px solid rgba(255, 255, 255, 0.85);
	padding: 11px 13px;
	background: rgba(255, 255, 255, 0.08);
}
.season-row svg {
	flex: none;
	width: 20px;
}
</style>
