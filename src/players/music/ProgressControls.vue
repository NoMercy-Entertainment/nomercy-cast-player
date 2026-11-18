<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { playbackStore } from '@/stores/playbackStore';
import type { RepeatMode } from '@/stores/playbackStore';
import { syncedSettings } from '@/lib/syncedSettings';
import { musicSyncBridge } from './syncBridge';
import TvPanelToggles from './TvPanelToggles.vue';
import { formatSeconds } from '@nomercy-entertainment/nomercy-player-core';
import { progressPercent, totalLabel } from './transport';

/*
 * FullPlayerScreenTV BottomBar: the progress row, then like | transport pill | panel toggles.
 * Focus runs left to right through one horizontal group, as the Compose row does.
 */

const { t } = useTranslation();
const REPEAT_AFTER = {
	off: 'all',
	all: 'one',
	one: 'off',
} as const satisfies Record<RepeatMode, RepeatMode>;
const containerEl = ref<HTMLElement | null>(null);
const controlsGroup = useFocusGroup({
	type: 'horizontal',
	restorationKey: 'now-playing-controls',
	initialFocusKey: 'np-play',
	containerEl,
});

const likeEl = ref<HTMLElement | null>(null);
const shuffleEl = ref<HTMLElement | null>(null);
const prevEl = ref<HTMLElement | null>(null);
const playEl = ref<HTMLElement | null>(null);
const nextEl = ref<HTMLElement | null>(null);
const repeatEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'np-like',
	group: controlsGroup,
	order: 0,
	el: likeEl,
	onAction: () => {
		playbackStore.music.applyFavorite(!playbackStore.music.track.value?.favorite);
	},
});

useFocusEntry({
	key: 'np-shuffle',
	group: controlsGroup,
	order: 1,
	el: shuffleEl,
	onAction: () => {
		musicSyncBridge.setShuffle(!playbackStore.music.shuffle.value);
	},
});

useFocusEntry({
	key: 'np-prev',
	group: controlsGroup,
	order: 2,
	el: prevEl,
	onAction: () => musicSyncBridge.current()?.previous(),
});

useFocusEntry({
	key: 'np-play',
	group: controlsGroup,
	order: 3,
	el: playEl,
	onAction: () => {
		const e = musicSyncBridge.current();

		if (!e) return;

		if (playbackStore.music.playing.value) {
			e.pause();
		} else {
			e.play();
		}
	},
});

useFocusEntry({
	key: 'np-next',
	group: controlsGroup,
	order: 4,
	el: nextEl,
	onAction: () => musicSyncBridge.current()?.next(),
});

useFocusEntry({
	key: 'np-repeat',
	group: controlsGroup,
	order: 5,
	el: repeatEl,
	onAction: () => {
		musicSyncBridge.setRepeat(REPEAT_AFTER[playbackStore.music.repeat.value]);
	},
});

const playing = playbackStore.music.playing;
const time = playbackStore.music.timeMs;
const track = playbackStore.music.track;
const shuffle = playbackStore.music.shuffle;
const repeat = playbackStore.music.repeat;
const repeatLabel = computed(() => ({
	off: t('music.player.repeat_off'),
	all: t('music.player.repeat_all'),
	one: t('music.player.repeat_one'),
}));
const repeatIcon = {
	off: 'nmRepeatHalftone',
	all: 'nmRepeat',
	one: 'nmRepeatone',
} as const satisfies Record<'off' | 'all' | 'one', string>;
// Progressbar.kt:111-117: the end label is the length, or what is left when the account chose remaining.
const endText = computed(() => {
	const total = track.value?.duration_ms ?? 0;

	if (syncedSettings.value.timeChoice !== 'remaining' || track.value?.live || !total)
		return totalLabel(track.value);

	const leftSeconds = Math.round((total - time.value) / 1000);

	return formatSeconds(Math.max(0, leftSeconds));
});
const pct = computed(() => progressPercent(track.value, time.value));
</script>

<template>
	<div class="controls">
		<div class="progress-row">
			<span class="time">{{ formatSeconds(Math.round(time / 1000)) }}</span>
			<div class="bar">
				<div class="fill" :style="{ width: `${pct}%` }" />
			</div>
			<span class="time time-end">{{ endText }}</span>
		</div>
		<div class="bar-row">
			<div class="side side-start">
				<button
					ref="likeEl"
					data-focusable
					tabindex="0"
					class="side-btn"
					:class="{ active: track?.favorite }"
					:aria-label="t('views.music.like')"
				>
					<MoooomIcon :icon="track?.favorite ? 'heartFilled' : 'heart'" width="28" height="28" />
				</button>
			</div>
			<div ref="containerEl" class="buttons">
				<button
					ref="shuffleEl"
					data-focusable
					tabindex="0"
					class="ctrl-btn ctrl-aux"
					:class="{ active: shuffle }"
					:aria-label="t('music.player.shuffle')"
				>
					<MoooomIcon icon="nmShuffle" width="28" height="28" />
				</button>
				<button
					ref="prevEl"
					data-focusable
					tabindex="0"
					class="ctrl-btn"
					:aria-label="t('music.player.previous_track')"
				>
					<MoooomIcon icon="nmPrevious" width="28" height="28" />
				</button>
				<button
					ref="playEl"
					data-focusable
					tabindex="0"
					class="ctrl-btn ctrl-play"
					:aria-label="playing ? t('common.pause') : t('common.play')"
				>
					<MoooomIcon :icon="playing ? 'nmPause' : 'nmPlay'" width="36" height="36" />
				</button>
				<button
					ref="nextEl"
					data-focusable
					tabindex="0"
					class="ctrl-btn"
					:aria-label="t('music.player.next_track')"
				>
					<MoooomIcon icon="nmNext" width="28" height="28" />
				</button>
				<button
					ref="repeatEl"
					data-focusable
					tabindex="0"
					class="ctrl-btn ctrl-aux"
					:class="{ active: repeat !== 'off' }"
					:aria-label="repeatLabel[repeat]"
				>
					<MoooomIcon :icon="repeatIcon[repeat]" width="28" height="28" />
				</button>
			</div>
			<TvPanelToggles :group="controlsGroup" class="side side-end" />
		</div>
	</div>
</template>

<style scoped>
.controls {
	display: flex;
	flex-direction: column;
	gap: 8px;
	width: 100%;
}
/* Progressbar.kt:104-165: time, a flat 8 dp bar between 8 dp gaps, time. */
.progress-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.time {
	min-width: 48px;
	font-size: 14px;
	font-weight: 800;
	font-family: monospace;
	color: var(--cast-text-primary);
	font-variant-numeric: tabular-nums;
}
.time-end {
	text-align: end;
}
.bar {
	flex: 1 1 0;
	margin: 0 8px;
	height: 8px;
	background: oklch(1 0 0 / 0.2);
	border-radius: 50px;
	overflow: hidden;
}
.fill {
	height: 100%;
	background: var(--cast-text-primary);
	transition: width 200ms linear;
}
.bar-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.side {
	flex: 1 1 0;
	display: flex;
	align-items: center;
	gap: 6px;
}
.side-start {
	justify-content: flex-start;
}
/* TvBarControls.kt:29: the panel toggles sit at the end, 8 dp apart. */
.side-end {
	justify-content: flex-end;
	gap: 8px;
}
/* MediaLikeButton.kt:25-26: a 40 dp button with a 28 dp icon. */
.side-btn {
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
.side-btn.active {
	color: var(--color-primary, var(--color-accent));
}
.side-btn:focus-visible {
	transform: scale(1.08);
	border-color: var(--cast-white);
}
/* FullPlayerScreen.kt:536-562: 16 dp pill, 32 dp outside, 24 dp inside, 90 dp high, spacers 8 / 16. */
.buttons {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 8px;
	height: 90px;
	margin: 0 32px;
	padding: 0 24px;
	background: rgba(0, 0, 0, 0.4);
	border-radius: 16px;
}
.ctrl-btn {
	width: 48px;
	height: 48px;
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
		border-color var(--motion-fast),
		color var(--motion-fast);
}
.ctrl-aux.active {
	color: var(--color-primary, var(--color-accent));
}
.ctrl-play {
	width: 64px;
	height: 64px;
	margin: 0 8px;
	background: linear-gradient(var(--play-bg, var(--color-primary, var(--color-accent))), oklch(0.12 0.01 250 / 0.1));
	box-shadow: 0 12px 12px rgba(0, 0, 0, 0.3);
	color: var(--play-fg, var(--cast-white));
}
/* TvFocusRing.kt:41-51: a 3 dp ring inside the shape at scale 1.08. */
.ctrl-btn:focus-visible {
	transform: scale(1.08);
	border-color: var(--cast-white);
	outline: none;
}
</style>
