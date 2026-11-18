<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import type { FocusGroupRegistry } from '@/composables/useFocusEntry';
import { playbackStore } from '@/stores/playbackStore';
import { settingsStore } from '@/stores/settingsStore';

/*
 * TvBarControls.kt TvPanelToggles: the right-hand group of the bar. The visualizer, the
 * device button and the queue button have no receiver counterpart (the queue peek is always shown).
 */

const props = defineProps<{ group: FocusGroupRegistry }>();
const { t } = useTranslation();

const lyricsEl = ref<HTMLElement | null>(null);
const darkEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'np-lyrics',
	group: props.group,
	order: 6,
	el: lyricsEl,
	onAction: () => {
		playbackStore.music.applyLyricsOpen(!playbackStore.music.lyricsOpen.value);
	},
});

useFocusEntry({
	key: 'np-dark',
	group: props.group,
	order: 7,
	el: darkEl,
	onAction: () => {
		settingsStore.tvDarkMode.value = !settingsStore.tvDarkMode.value;
	},
});
</script>

<template>
	<div>
		<button
			ref="lyricsEl"
			data-focusable
			tabindex="0"
			class="toggle-btn"
			:class="{ active: playbackStore.music.lyricsOpen.value }"
			:aria-label="t('music.player.lyrics')"
		>
			<MoooomIcon icon="lyrics" width="28" height="28" />
		</button>
		<button
			ref="darkEl"
			data-focusable
			tabindex="0"
			class="toggle-btn"
			:aria-label="t('music.player.dark_mode')"
		>
			<MoooomIcon :icon="settingsStore.tvDarkMode.value ? 'sun' : 'moon'" width="28" height="28" />
		</button>
	</div>
</template>

<style scoped>
/* IconButton is 40 dp with a 28 dp icon; the ring is the shared 3 dp TV focus ring (TvFocusRing.kt:41-51). */
.toggle-btn {
	width: 40px;
	height: 40px;
	border: 3px solid transparent;
	border-radius: 50%;
	background: transparent;
	color: var(--cast-text-primary);
	cursor: pointer;
	outline: none;
	display: grid;
	place-items: center;
	transition:
		transform var(--motion-fast),
		border-color var(--motion-fast);
}
.toggle-btn:focus-visible {
	transform: scale(1.08);
	border-color: var(--cast-white);
}
</style>
