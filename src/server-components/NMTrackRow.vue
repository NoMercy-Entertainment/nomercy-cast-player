<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useFocusEntry } from '@/composables/useFocusEntry';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import { buildImageUrl } from '@/lib/images/urls';
import { playbackStore } from '@/stores/playbackStore';
import { musicSyncBridge } from '@/players/music/syncBridge';
import type { NMTrackRowWrapper, Update } from './types';

const props = defineProps<{
	id: string;
	data: NMTrackRowWrapper;
	update?: Update;
}>();

const router = useRouter();
const el = ref<HTMLElement | null>(null);
const cover = buildImageUrl(props.data.cover, { width: 64, height: 64 });

const isCurrentTrack = computed(
	() => playbackStore.music.track.value?.id === props.data.id,
);

const isPlayingCurrent = computed(
	() => isCurrentTrack.value && playbackStore.music.playing.value,
);

useFocusEntry({
	key: props.id,
	el,
	onAction: () => {
		if (isCurrentTrack.value) {
			const engine = musicSyncBridge.current();
			if (engine) {
				if (playbackStore.music.playing.value)
					engine.pause();
				else
					engine.play();
				return;
			}
		}
		if (props.data.link)
			router.push(props.data.link);
	},
});
</script>

<template>
	<article
		ref="el"
		class="track-row"
		:class="[{ 'is-current': isCurrentTrack }]"
		data-focusable
		tabindex="0"
		role="button"
	>
		<span class="leading">
			<MoooomIcon v-if="isPlayingCurrent" icon="nmPause" width="20" height="20" />
			<MoooomIcon v-else-if="isCurrentTrack" icon="nmPlay" width="20" height="20" />
			<span v-else class="position">{{ props.data.position ?? '' }}</span>
		</span>
		<img v-if="cover" :src="cover" :alt="props.data.name" class="cover">
		<div class="meta">
			<p class="name">
				{{ props.data.name }}
			</p>
			<p v-if="props.data.artist" class="artist">
				{{ props.data.artist }}
			</p>
		</div>
		<span v-if="props.data.duration" class="duration">{{ props.data.duration }}</span>
	</article>
</template>

<style scoped>
.track-row {
	display: grid;
	grid-template-columns: 32px 64px 1fr auto;
	align-items: center;
	gap: 16px;
	height: 48px;
	padding: 8px 16px;
	border: 2px solid transparent;
	background: oklch(0.18 0.015 250 / 0.2);
	cursor: pointer;
	border-radius: 8px;
	outline: none;
	text-align: start;
	width: 100%;
	transition:
		background var(--motion-fast),
		border-color var(--motion-fast);
}
.track-row:focus-visible {
	background: rgba(255, 255, 255, 0.06);
	border-color: var(--color-primary, oklch(0.7 0.2 285));
}
.track-row.is-current .name {
	color: var(--color-primary, oklch(0.7 0.2 285));
}
.leading {
	display: grid;
	place-items: center;
	color: var(--color-primary, oklch(0.7 0.2 285));
}
.position {
	color: var(--color-text-secondary);
	font-variant-numeric: tabular-nums;
	font-size: 14px;
}
.cover {
	width: 40px;
	height: 40px;
	border-radius: 4px;
	object-fit: cover;
}
.name {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
}
.artist {
	margin: 2px 0 0;
	font-size: 14px;
	color: var(--color-text-secondary);
}
.duration {
	color: var(--color-text-secondary);
	font-variant-numeric: tabular-nums;
}
</style>
