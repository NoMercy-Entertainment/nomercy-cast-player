<script setup lang="ts">
import { computed } from 'vue';

import type { GuideItem, GuideRow, GuideWindow } from '@/lib/plugin/epg';

import type { Update } from './types';

import { layoutGuide, nowOffset, windowMinutes } from '@/lib/plugin/epg';

/**
 * The guide as the receiver draws it: read only.
 *
 * A television has no keyboard and the sender drives it, so nothing here is
 * pressable. What it does carry is every programme's own description, because
 * a row of coloured bars five meters away tells the room nothing.
 */
interface GuideData {
	channels: { channelId: string; number: number; name: string }[];
	programmes: {
		programmeId: string;
		channelId: string;
		title: string;
		start: string;
		stop: string;
	}[];
	from: string;
	to: string;
	now?: string;
}

const props = defineProps<{
	id: string;
	data: GuideData;
	update?: Update;
}>();

const window = computed<GuideWindow>(() => ({
	from: new Date(props.data.from),
	to: new Date(props.data.to),
}));

const rows = computed<GuideRow[]>(() =>
	layoutGuide(props.data.channels ?? [], props.data.programmes ?? [], window.value));

const span = computed<number>(() => windowMinutes(window.value));

const marker = computed<number | null>(() =>
	nowOffset(window.value, props.data.now ? new Date(props.data.now) : new Date()));

function clock(minutes: number): string {
	const at = new Date(window.value.from.getTime() + minutes * 60_000);

	return at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function describe(item: GuideItem, row: GuideRow): string {
	return `${item.title}, ${row.name}, ${clock(item.offsetMinutes)} to ${clock(item.offsetMinutes + item.widthMinutes)}`;
}
</script>

<template>
	<div class="plugin-epg">
		<table role="grid" aria-label="Guide">
			<tbody>
				<tr v-for="row in rows" :key="row.channelId" :data-channel="row.channelId">
					<th scope="row">
						<span>{{ row.number }}</span>
						<span>{{ row.name }}</span>
					</th>

					<td>
						<div class="epg-row">
							<div
								v-for="item in row.items"
								:key="item.programmeId"
								class="epg-item"
								:class="{ 'is-clipped-start': item.clippedStart, 'is-clipped-stop': item.clippedStop }"
								:data-programme="item.programmeId"
								:aria-label="describe(item, row)"
								:style="{
									insetInlineStart: `${(item.offsetMinutes / span) * 100}%`,
									inlineSize: `${(item.widthMinutes / span) * 100}%`,
								}"
							>
								{{ item.title }}
							</div>

							<p v-if="row.items.length === 0" class="epg-empty">
								Nothing scheduled
							</p>
						</div>
					</td>
				</tr>
			</tbody>
		</table>

		<!-- Decoration: every programme already says when it runs. -->
		<div
			v-if="marker !== null"
			aria-hidden="true"
			data-now-line
			:style="{ insetInlineStart: `${(marker / span) * 100}%` }"
		/>
	</div>
</template>

<style scoped>
.plugin-epg {
	position: relative;
	inline-size: 100%;
}
.epg-row {
	position: relative;
	block-size: 3rem;
}
.epg-item {
	position: absolute;
	inset-block: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.08);
	padding: 4px 8px;
}
.epg-item.is-clipped-start {
	border-start-start-radius: 0;
	border-end-start-radius: 0;
}
.epg-item.is-clipped-stop {
	border-start-end-radius: 0;
	border-end-end-radius: 0;
}
.epg-empty {
	margin: 0;
	padding: 4px 8px;
	color: var(--color-text-secondary);
}
[data-now-line] {
	position: absolute;
	inset-block: 0;
	inline-size: 2px;
	background: var(--color-primary, oklch(0.7 0.2 285));
}
</style>
