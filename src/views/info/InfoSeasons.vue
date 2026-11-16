<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import type { InfoSeason } from '@/queries/useInfoQuery';
import Resolver from '@/server-components/Resolver.vue';
import type { Component } from '@/server-components/types';
import SeasonPickerOverlay from './SeasonPickerOverlay.vue';

/*
 * InfoComponentMapping.kt:46-66 and TvHomeAdapter.kt:449-473: the seasons row of
 * the info page. Its title is a season chip when there is more than one season,
 * and its cards are the selected season's episodes.
 */
const props = defineProps<{ seasons: InfoSeason[] }>();

const selected = ref<number | null>(null);
const open = ref(false);
const chipEl = ref<HTMLElement | null>(null);

const options = computed(() =>
	props.seasons.map((s) => ({ number: s.season_number ?? 0, label: `${s.season_number ?? 0} - ${s.title ?? ''}` })),
);
const current = computed(() =>
	props.seasons.find((s) => s.season_number === selected.value) ?? props.seasons[0],
);
const label = computed(() => options.value.find((o) => o.number === current.value?.season_number)?.label ?? '');

const rail = computed(() => {
	const season = current.value;
	const id = `info-seasons-${season?.season_number ?? 0}`;
	const items = (season?.episodes ?? [])
		.filter((e) => e.link)
		.map((e) => ({
			id: `episode-${e.id}`,
			component: 'NMCard',
			props: {
				id: `episode-${e.id}`,
				data: {
					id: String(e.id),
					title: e.episode_number != null
						? `${e.episode_number}. ${e.title ?? ''}`
						: (e.title ?? ''),
					image: e.still ?? undefined,
					link: e.link,
					type: 'episode',
					wide: true,
				},
			},
		}) as const satisfies Component);

	return {
		id,
		component: 'NMCarousel',
		props: { id, items },
	} as const satisfies Component;
});

const group = useFocusGroup({
	type: 'vertical',
	// The rail registers first as a proxy entry, so the chip takes order -1 to stay above it.
	onEscape: (dir) =>
		dir === 'right'
			? group.handleKey('down')
			: false,
});

useFocusEntry({
	key: 'season-chip',
	group,
	order: -1,
	el: chipEl,
	onAction: () => {
		open.value = true;
	},
});

function choose(number: number): void {
	selected.value = number;
	close();
}

function close(): void {
	open.value = false;
	void nextTick(() => chipEl.value?.focus());
}
</script>

<template>
	<section v-if="props.seasons.length" class="info-seasons">
		<button
			v-if="props.seasons.length > 1"
			ref="chipEl"
			class="season-chip"
			type="button"
			data-focusable
			tabindex="0"
			aria-haspopup="listbox"
			@click="open = true"
		>
			<span>{{ label }}</span>
			<MoooomIcon icon="chevronDown" width="20" height="20" />
		</button>
		<Resolver :key="rail.id" :component="rail" />
		<SeasonPickerOverlay
			v-if="open"
			:options="options"
			:selected="current?.season_number ?? null"
			@select="choose"
			@close="close"
		/>
	</section>
</template>

<style scoped>
.info-seasons {
	position: relative;
	z-index: 1;
}
.season-chip {
	position: relative;
	display: flex;
	align-items: center;
	box-sizing: border-box;
	height: 38px;
	width: calc((100vw - 40px - 42px - 24px) / 3 + 8px);
	margin: 0 0 12px 40px;
	padding: 0 40px 0 12px;
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 12px;
	background: transparent;
	color: var(--cast-text-primary);
	font-size: 14px;
	font-weight: 500;
	text-align: left;
	outline: none;
	cursor: pointer;
}
.season-chip:focus-visible {
	border: 3px solid rgba(255, 255, 255, 0.85);
	padding: 0 38px 0 10px;
}
.season-chip svg {
	position: absolute;
	right: 12px;
	top: 50%;
	width: 20px;
	height: 20px;
	margin-top: -10px;
}
</style>
