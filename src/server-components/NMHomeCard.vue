<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import FallbackPoster from '@/components/cards/FallbackPoster.vue';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import SplitTitleText from '@/components/text/SplitTitleText.vue';
import { BACKDROP_SIZE, buildImageUrl } from '@/lib/images/urls';
import type { NMHomeCardWrapper, Update } from './types';

/*
 * Hero card on home — matches APK NMHomeCard.kt's TV layout:
 *   Edge-to-edge backdrop, OverlayGradient scrim, Watch / Details
 *   buttons stacked in the left 60%. Each button is individually
 *   D-pad focusable (mirrors APK NMHomeCardLeftColumn LinkButtons).
 */
const props = defineProps<{
	id: string;
	data: NMHomeCardWrapper;
	update?: Update;
}>();

const router = useRouter();

const imageSource
	= (props.data as unknown as { backdrop?: string }).backdrop
		?? (props.data as unknown as { poster?: string }).poster
		?? props.data.image;
const imageUrl = computed(() => buildImageUrl(imageSource, BACKDROP_SIZE));

const overview = computed(
	() =>
		(props.data as unknown as { overview?: string; description?: string }).overview
		?? props.data.description
		?? '',
);

const watchPath = computed(() => {
	const link = props.data.link;
	if (!link)
		return null;
	return link.endsWith('/watch') ? link : `${link}/watch`;
});

const detailsPath = computed(() => props.data.link ?? null);

const actionsEl = ref<HTMLElement | null>(null);
const actionsGroup = useFocusGroup({
	type: 'horizontal',
	restorationKey: `home-card-${props.id}`,
	containerEl: actionsEl,
});

const watchEl = ref<HTMLElement | null>(null);
const detailsEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: `${props.id}-watch`,
	group: actionsGroup,
	el: watchEl,
	onAction: () => {
		if (watchPath.value)
			router.push(watchPath.value);
	},
});

useFocusEntry({
	key: `${props.id}-details`,
	group: actionsGroup,
	el: detailsEl,
	onAction: () => {
		if (detailsPath.value)
			router.push(detailsPath.value);
	},
});
</script>

<template>
	<section class="hero" :data-card-id="id">
		<div class="art">
			<img
				v-if="imageUrl"
				class="nm-cover-top"
				:src="imageUrl"
				:alt="props.data.title ?? ''"
				loading="eager"
				decoding="async"
			>
			<FallbackPoster v-else :title="props.data.title" />
			<div class="nm-hero-scrim" />
		</div>

		<div class="content">
			<p v-if="props.data.show" class="show">
				{{ props.data.show }}
			</p>
			<div v-if="props.data.season || props.data.episode" class="se">
				<span v-if="props.data.season">S{{ props.data.season }}</span>
				<span v-if="props.data.episode">E{{ props.data.episode }}</span>
			</div>
			<SplitTitleText
				:title="props.data.title"
				main-class="nm-hero-title-main"
				subtitle-class="nm-hero-title-sub"
			/>
			<p v-if="overview" class="nm-hero-overview">
				{{ overview }}
			</p>

			<div ref="actionsEl" class="actions">
				<button
					v-if="watchPath"
					ref="watchEl"
					type="button"
					class="nm-pill nm-pill-primary"
					data-focusable
					tabindex="0"
					@click.prevent="watchPath && router.push(watchPath)"
				>
					<MoooomIcon icon="nmPlay" width="16" height="16" />
					Watch
				</button>
				<button
					v-if="detailsPath"
					ref="detailsEl"
					type="button"
					class="nm-pill nm-pill-secondary"
					data-focusable
					tabindex="0"
					@click.prevent="detailsPath && router.push(detailsPath)"
				>
					<MoooomIcon icon="infoCircle" width="16" height="16" />
					Details
				</button>
			</div>
		</div>
	</section>
</template>

<style scoped>
.hero {
	position: relative;
	display: block;
	width: 100%;
	/* Match HomeHero so the two never stack at different heights when the
		server emits NMHomeCard as a top-level component alongside the
		focus-driven hero. */
	height: var(--hero-height);
	overflow: hidden;
	border: 0;
	background: oklch(0.12 0.01 250);
	padding: 0;
}
.art {
	position: absolute;
	inset: 0;
}
.content {
	position: absolute;
	inset: 0;
	width: 60%;
	padding: 24px 40px 0;
	color: var(--cast-text-primary);
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 12px;
}
.show {
	margin: 0;
	font-size: 13px;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: oklch(0.85 0.01 250);
}
.se {
	display: flex;
	gap: 4px;
	font-size: 14px;
	font-weight: 600;
	letter-spacing: 0.05em;
	color: oklch(0.85 0.01 250);
}
.actions {
	display: flex;
	gap: 12px;
	margin-top: 8px;
}
</style>
