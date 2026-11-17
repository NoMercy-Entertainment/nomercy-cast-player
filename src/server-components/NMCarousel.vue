<script setup lang="ts">
import { ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import HorizontalRail from '@/components/rails/HorizontalRail.vue';
import Resolver from './Resolver.vue';
import { showAllLabel } from './showAllLabel';
import type { NMCarouselWrapper, Update } from './types';

/*
 * Horizontal carousel — title + items. Mirrors APK NMCarousel.kt:
 *   - Header: title only (no separate "more" link in Compose; the
 *     end-cap "Show All" pill at the right of the rail handles it).
 *   - End-cap pill rendered as the last focusable item when more_link
 *     is set.
 */
const props = defineProps<{
	id: string;
	data: NMCarouselWrapper;
	update?: Update;
}>();

const containerEl = ref<HTMLElement | null>(null);
const showAllEl = ref<HTMLElement | null>(null);
const router = useRouter();

function captureRail(instance: ComponentPublicInstance | Element | null): void {
	const track = instance && 'trackEl' in instance
		? instance.trackEl
		: null;

	containerEl.value = track instanceof HTMLElement
		? track
		: null;
}

const railGroup = useFocusGroup({
	type: 'horizontal',
	restorationKey: `carousel-${props.id}`,
	containerEl,
});

// Show All is the last card of its row (TvHomeAdapter.kt:540-561), so it joins this row's group.
useFocusEntry({
	key: `${props.id}-show-all`,
	group: railGroup,
	order: Number.MAX_SAFE_INTEGER,
	el: showAllEl,
	onAction: () => {
		if (props.data.more_link) {
			router.push(props.data.more_link);
		}
	},
});
</script>

<template>
	<section v-if="props.data.items?.length" class="rail-section" :data-rail-id="id">
		<header v-if="props.data.title" class="rail-header">
			<h2>{{ props.data.title }}</h2>
		</header>

		<HorizontalRail :ref="captureRail">
			<Resolver
				v-for="item in props.data.items"
				:key="item.id"
				:component="item"
			/>
			<a
				v-if="props.data.more_link"
				ref="showAllEl"
				class="show-all nm-focus-scale"
				:href="props.data.more_link"
				data-focusable
				tabindex="0"
				@click.prevent="props.data.more_link && router.push(props.data.more_link)"
			>
				<span class="show-all-text">
					{{ showAllLabel(props.data.title) }}
				</span>
			</a>
		</HorizontalRail>
	</section>
</template>

<style scoped>
.rail-section {
	display: flex;
	flex-direction: column;
	contain: layout paint;
}
.rail-header {
	display: flex;
	align-items: center;
	height: 36px;
	box-sizing: border-box;
	padding: 4px 16px 4px 40px;
}
.rail-header h2 {
	margin: 0;
	font-size: 14px;
	font-weight: 500;
	letter-spacing: -0.005em;
	color: oklch(1 0 0);
}
.show-all {
	flex: 0 0 auto;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: var(--rail-card-width, 180px);
	aspect-ratio: 2/3;
	border-radius: var(--radius-card);
	background: var(--nm-surface);
	border: 1px solid var(--color-primary, var(--cast-white));
	color: var(--cast-text-primary);
	text-decoration: none;
	font-size: 16px;
	font-weight: 500;
	text-align: center;
	padding: 12px;
	cursor: pointer;
	transition:
		border-color var(--motion-fast),
		background var(--motion-fast),
		box-shadow var(--motion-fast);
}
/* Alone in the row, the cards are still loading: keep the room, draw nothing. */
.show-all:only-child {
	visibility: hidden;
}
.show-all:focus-visible {
	border-color: var(--cast-white);
	box-shadow: inset 0 0 0 1px var(--cast-white);
	outline: none;
}
.show-all-text {
	white-space: pre-line;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
