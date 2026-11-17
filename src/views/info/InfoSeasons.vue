<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { InfoSeason } from '@/queries/useInfoQuery';
import Resolver from '@/server-components/Resolver.vue';
import type { Component } from '@/server-components/types';
import SeasonPickerOverlay from './SeasonPickerOverlay.vue';

/*
 * InfoComponentMapping.kt:46-66 and TvHomeAdapter.kt:449-473: the seasons row of
 * the info page. Its title is a season chip when there is more than one season,
 * and its cards are the selected season's episodes.
 */
const props = defineProps<{
	/** The info DTO's seasons: the picker options, and the episodes when the server sent no rows. */
	seasons: InfoSeason[];
	/** The rows: collection, per-season rows from the server, writer and director, cast, crew. */
	rows?: Component[];
}>();

const selected = ref<number | null>(null);
const open = ref(false);
const chipEl = ref<HTMLElement | null>(null);

type RowProps = { properties?: Record<string, string>; title?: string };

const rowProps = (row: Component): RowProps => row.props as RowProps;
const isSeasonsRow = (row: Component): boolean => rowProps(row).properties?.rowType === 'seasons';
const seasonRows = computed(() => (props.rows ?? []).filter(isSeasonsRow));
const otherRows = computed(() => (props.rows ?? []).filter((r) => !isSeasonsRow(r)));
// InfoComponentMapping.kt:47-52: a collection and seasons never draw together.
const seasonsAllowed = computed(() => !otherRows.value.some((r) => r.id === 'info-collection'));

const options = computed(() => props.seasons.length
	? props.seasons.map((s) => ({ number: s.season_number ?? 0, label: `${s.season_number ?? 0} - ${s.title ?? ''}` }))
	: seasonRows.value.map((r) => ({
			number: Number(rowProps(r).properties?.season_number ?? 0),
			label: rowProps(r).title ?? '',
		})));
// InfoScreen.kt:167-172: season 1 opens first, else the first one (Specials is season 0).
const currentNumber = computed(() =>
	(options.value.find((o) => o.number === selected.value)
		?? options.value.find((o) => o.number === 1)
		?? options.value[0])?.number,
);
const current = computed(() => props.seasons.find((s) => s.season_number === currentNumber.value));
const label = computed(() => options.value.find((o) => o.number === currentNumber.value)?.label ?? '');

// The server's row for the selected season, found by its season_number property.
function serverRail(number: number | undefined): Component | null {
	const row = seasonRows.value.find((r) => Number(rowProps(r).properties?.season_number) === number);

	if (!row)
		return null;

	const { items } = row.props as { items: Component[] };

	return {
		...row,
		props: {
			...row.props,
			title: options.value.length === 1 ? rowProps(row).title : undefined,
			items: items.map((item) => ({
				...item,
				props: { ...item.props, data: { ...(item.props as { data: object }).data, wide: true } },
			})),
		},
	} as Component;
}

const rail = computed<Component | null>(() => {
	if (!seasonsAllowed.value)
		return null;

	if (seasonRows.value.length)
		return serverRail(currentNumber.value);

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

	// InfoComponentMapping.kt:55: a season without episodes adds no row, and the chip lives in that row.
	if (!items.length)
		return null;

	return {
		id,
		component: 'NMCarousel',
		// With one season there is no chip, so the row title names it (InfoComponentMapping.kt:56-62).
		props: {
			id,
			items,
			title: props.seasons.length === 1
				? label.value
				: undefined,
		},
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
	<section v-if="rail || otherRows.length" class="info-seasons">
		<button
			v-if="rail && options.length > 1"
			ref="chipEl"
			class="season-chip"
			type="button"
			data-focusable
			tabindex="0"
			aria-haspopup="listbox"
			@click="open = true"
			@focus="focusedCardStore.setActive(null)"
		>
			<span>{{ label }}</span>
			<MoooomIcon icon="chevronDown" width="20" height="20" />
		</button>
		<Resolver v-if="rail" :key="rail.id" :component="rail" />
		<Resolver
			v-for="row in otherRows"
			:key="row.id"
			:component="row"
		/>
		<SeasonPickerOverlay
			v-if="open"
			:options="options"
			:selected="currentNumber ?? null"
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
	width: calc((100vw - 40px - 42px - 24px) / 3);
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
