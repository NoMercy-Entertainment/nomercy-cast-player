<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import SearchKey from './SearchKey.vue';

/*
 * APK SearchKeyboard.kt — 6-column LazyVerticalGrid:
 *   Row 1: [Space (×2), Backspace (×2), Video (×1), Music (×1)]
 *   Rows 2-5: 26 letters a-z (4 rows × 6 cols, last row has empties)
 *   Rows 6-7: digits 1-9 + 0 (10 / 6 cols)
 *
 * The Video/Music keys aren't input — they switch SearchType. We mirror
 * that here as a `mode` emit that the parent screen listens for.
 */

interface Props {
	mode: 'video' | 'music';
}
defineProps<Props>();

const emit = defineEmits<{
	type: [letter: string];
	backspace: [];
	space: [];
	mode: [next: 'video' | 'music'];
}>();

const { t } = useTranslation();
const containerEl = ref<HTMLElement | null>(null);
// 'free' spatial nav instead of 'grid' — the utility row has 4 keys
// covering 6 logical columns (Space + Backspace each span 2 cells), so
// the index-based grid math walked DOWN from "Space" to letter "C"
// instead of "A". Geometric nearest-neighbor mirrors APK Compose's
// LazyVerticalGrid focus traversal accurately.
useFocusGroup({
	type: 'free',
	restorationKey: 'search-keyboard',
	initialFocusKey: 'kb-a',
	containerEl,
});

const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
</script>

<template>
	<div ref="containerEl" class="kb">
		<div class="kb-row utility-row">
			<SearchKey
				focus-key="kb-space"
				label="⎵"
				:aria-label="t('views.search.space')"
				variant="hot"
				class="span-2"
				@press="emit('space')"
			/>
			<SearchKey
				focus-key="kb-back"
				label="⌫"
				:aria-label="t('views.search.backspace')"
				variant="hot"
				class="span-2"
				@press="emit('backspace')"
			/>
			<SearchKey
				focus-key="kb-video"
				label="🎬"
				:aria-label="t('views.search_videos')"
				:variant="mode === 'video' ? 'mode-active' : 'mode'"
				@press="emit('mode', 'video')"
			/>
			<SearchKey
				focus-key="kb-music"
				label="🎵"
				:aria-label="t('views.search_music')"
				:variant="mode === 'music' ? 'mode-active' : 'mode'"
				@press="emit('mode', 'music')"
			/>
		</div>
		<div class="kb-grid">
			<SearchKey
				v-for="l in letters"
				:key="l"
				:focus-key="`kb-${l}`"
				:label="l.toUpperCase()"
				@press="emit('type', l)"
			/>
		</div>
		<div class="kb-grid">
			<SearchKey
				v-for="n in digits"
				:key="n"
				:focus-key="`kb-${n}`"
				:label="n"
				variant="number"
				@press="emit('type', n)"
			/>
		</div>
	</div>
</template>

<style scoped>
.kb {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 4px;
}
.kb-row {
	display: grid;
	grid-template-columns: repeat(6, 1fr);
	gap: 4px;
}
.kb-grid {
	display: grid;
	grid-template-columns: repeat(6, 1fr);
	gap: 4px;
}
.utility-row :deep(.span-2) {
	grid-column: span 2;
	aspect-ratio: 2 / 1;
}
</style>
