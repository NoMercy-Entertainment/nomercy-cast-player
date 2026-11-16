<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import HorizontalRail from '@/components/rails/HorizontalRail.vue';
import Resolver from './Resolver.vue';
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

function captureRail(instance: unknown): void {
	const track = (instance as { trackEl?: HTMLElement | null } | null)?.trackEl;
	containerEl.value = track ?? null;
}

useFocusGroup({
	type: 'horizontal',
	restorationKey: `carousel-${props.id}`,
	containerEl,
});

useFocusEntry({
	key: `${props.id}-show-all`,
	el: showAllEl,
	onAction: () => {
		if (props.data.more_link)
			router.push(props.data.more_link);
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
					{{ props.data.more_link_text || `Show All ${props.data.title}` }}
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
	align-items: baseline;
	padding: 0 var(--tv-safe-padding) 0 40px;
}
.rail-header h2 {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
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
	background: rgba(0, 0, 0, 0.55);
	border: 1px solid rgba(255, 255, 255, 0.08);
	color: #fff;
	text-decoration: none;
	font-size: 14px;
	font-weight: 600;
	text-align: center;
	padding: 16px;
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
	border-color: var(--color-primary, oklch(0.7 0.2 285));
	background: rgba(0, 0, 0, 0.75);
	box-shadow:
		0 0 0 2px var(--color-primary, oklch(0.7 0.2 285)),
		0 12px 32px rgba(0, 0, 0, 0.6);
	outline: none;
}
.show-all-text {
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
