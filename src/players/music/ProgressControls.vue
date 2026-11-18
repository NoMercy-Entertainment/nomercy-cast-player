<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { playbackStore } from '@/stores/playbackStore';
import type { RepeatMode } from '@/stores/playbackStore';
import { musicSyncBridge } from './syncBridge';
import { formatSeconds } from '@nomercy-entertainment/nomercy-player-core';
import { progressPercent, totalLabel } from './transport';

/*
 * APK FullPlayerScreenTV controls row (mirrored): shuffle | prev | play | next | repeat
 * Plus a top utility row: like | lyrics | queue. Buttons use Moooom-style
 * SVG icons rather than emoji for crisp rendering on TV displays.
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

const shuffleEl = ref<HTMLElement | null>(null);
const prevEl = ref<HTMLElement | null>(null);
const playEl = ref<HTMLElement | null>(null);
const nextEl = ref<HTMLElement | null>(null);
const repeatEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'np-shuffle',
	group: controlsGroup,
	el: shuffleEl,
	onAction: () => {
		musicSyncBridge.setShuffle(!playbackStore.music.shuffle.value);
	},
});

useFocusEntry({
	key: 'np-prev',
	group: controlsGroup,
	el: prevEl,
	onAction: () => musicSyncBridge.current()?.previous(),
});

useFocusEntry({
	key: 'np-play',
	group: controlsGroup,
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
	el: nextEl,
	onAction: () => musicSyncBridge.current()?.next(),
});

useFocusEntry({
	key: 'np-repeat',
	group: controlsGroup,
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
const totalText = computed(() => totalLabel(track.value));
const pct = computed(() => progressPercent(track.value, time.value));
</script>

<template>
	<div class="controls">
		<div class="progress-row">
			<span class="time">{{ formatSeconds(Math.round(time / 1000)) }}</span>
			<div class="bar">
				<div class="fill" :style="{ width: `${pct}%` }" />
			</div>
			<span class="time">{{ totalText }}</span>
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
				<MoooomIcon icon="nmShuffle" width="22" height="22" />
			</button>
			<button
				ref="prevEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn"
				:aria-label="t('music.player.previous_track')"
			>
				<MoooomIcon icon="nmPrevious" width="26" height="26" />
			</button>
			<button
				ref="playEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn ctrl-play"
				:aria-label="playing ? t('common.pause') : t('common.play')"
			>
				<MoooomIcon :icon="playing ? 'nmPause' : 'nmPlay'" width="32" height="32" />
			</button>
			<button
				ref="nextEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn"
				:aria-label="t('music.player.next_track')"
			>
				<MoooomIcon icon="nmNext" width="26" height="26" />
			</button>
			<button
				ref="repeatEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn ctrl-aux"
				:class="{ active: repeat !== 'off' }"
				:aria-label="repeatLabel[repeat]"
			>
				<MoooomIcon :icon="repeatIcon[repeat]" width="22" height="22" />
			</button>
		</div>
	</div>
</template>

<style scoped>
.controls {
	display: flex;
	flex-direction: column;
	gap: 16px;
	width: 100%;
	max-width: 720px;
}
.progress-row {
	display: grid;
	grid-template-columns: 64px 1fr 64px;
	align-items: center;
	gap: 16px;
}
.time {
	font-size: 14px;
	color: var(--color-text-secondary);
	font-variant-numeric: tabular-nums;
	text-align: center;
}
.bar {
	height: 4px;
	background: oklch(1 0 0 / 0.18);
	border-radius: 999px;
	overflow: hidden;
}
.fill {
	height: 100%;
	background: var(--color-primary, var(--color-accent));
	transition: width 200ms linear;
}
.buttons {
	display: flex;
	gap: 14px;
	justify-content: flex-start;
	align-items: center;
	height: 90px;
	padding: 0 32px;
	background: rgba(0, 0, 0, 0.4);
	border-radius: 16px;
}
.ctrl-btn {
	width: 60px;
	height: 60px;
	border: 0;
	border-radius: 50%;
	background: oklch(1 0 0 / 0.08);
	color: var(--color-text-primary);
	cursor: pointer;
	outline: none;
	display: grid;
	place-items: center;
	transition:
		transform var(--motion-fast),
		background var(--motion-fast),
		color var(--motion-fast);
}
.ctrl-aux {
	width: 48px;
	height: 48px;
	color: oklch(1 0 0 / 0.7);
}
.ctrl-aux.active {
	color: var(--color-primary, var(--color-accent));
	background: oklch(1 0 0 / 0.12);
}
.ctrl-play {
	width: 64px;
	height: 64px;
	background: linear-gradient(var(--color-primary, var(--color-accent)), oklch(0.12 0.01 250 / 0.1));
	box-shadow: 0 12px 12px rgba(0, 0, 0, 0.3);
	color: oklch(0.18 0.02 35);
}
.ctrl-btn:focus-visible {
	transform: scale(1.08);
	background: oklch(1 0 0 / 0.18);
	outline: 3px solid var(--cast-white);
}
.ctrl-play:focus-visible {
	background: linear-gradient(var(--color-primary, var(--color-accent)), oklch(0.12 0.01 250 / 0.1));
	box-shadow: 0 0 0 3px var(--cast-white);
}
</style>
