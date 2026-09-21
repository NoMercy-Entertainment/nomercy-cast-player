<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { playbackStore } from '@/stores/playbackStore';
import { musicSyncBridge } from './syncBridge';
import { formatTime, progressPercent, totalLabel } from './transport';

/*
 * APK FullPlayerScreenTV controls row (mirrored): shuffle | prev | play | next | repeat
 * Plus a top utility row: like | lyrics | queue. Buttons use Moooom-style
 * SVG icons rather than emoji for crisp rendering on TV displays.
 */

const containerEl = ref<HTMLElement | null>(null);
useFocusGroup({
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
	el: shuffleEl,
	onAction: () => {
		const next = !playbackStore.music.shuffle.value;
		playbackStore.music.applyShuffle(next);
	},
});
useFocusEntry({
	key: 'np-prev',
	el: prevEl,
	onAction: () => musicSyncBridge.current()?.previous(),
});
useFocusEntry({
	key: 'np-play',
	el: playEl,
	onAction: () => {
		const e = musicSyncBridge.current();
		if (!e)
			return;
		if (playbackStore.music.playing.value)
			e.pause();
		else e.play();
	},
});
useFocusEntry({
	key: 'np-next',
	el: nextEl,
	onAction: () => musicSyncBridge.current()?.next(),
});
useFocusEntry({
	key: 'np-repeat',
	el: repeatEl,
	onAction: () => {
		const cur = playbackStore.music.repeat.value;
		const next = cur === 'off' ? 'all' : cur === 'all' ? 'one' : 'off';
		playbackStore.music.applyRepeat(next);
	},
});

const playing = playbackStore.music.playing;
const time = playbackStore.music.timeMs;
const track = playbackStore.music.track;
const shuffle = playbackStore.music.shuffle;
const repeat = playbackStore.music.repeat;
const totalText = computed(() => totalLabel(track.value));
const pct = computed(() => progressPercent(track.value, time.value));
</script>

<template>
	<div class="controls">
		<div class="progress-row">
			<span class="time">{{ formatTime(time) }}</span>
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
				aria-label="Shuffle"
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="16 3 21 3 21 8" />
					<line x1="4" y1="20" x2="21" y2="3" />
					<polyline points="21 16 21 21 16 21" />
					<line x1="15" y1="15" x2="21" y2="21" />
					<line x1="4" y1="4" x2="9" y2="9" />
				</svg>
			</button>
			<button
				ref="prevEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn"
				aria-label="Previous track"
			>
				<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
					<path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
				</svg>
			</button>
			<button
				ref="playEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn ctrl-play"
				:aria-label="playing ? 'Pause' : 'Play'"
			>
				<svg v-if="playing" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
				<svg v-else width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5v14l11-7z" />
				</svg>
			</button>
			<button
				ref="nextEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn"
				aria-label="Next track"
			>
				<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
					<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
				</svg>
			</button>
			<button
				ref="repeatEl"
				data-focusable
				tabindex="0"
				class="ctrl-btn ctrl-aux"
				:class="{ active: repeat !== 'off' }"
				:aria-label="`Repeat ${repeat}`"
			>
				<svg v-if="repeat === 'one'" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="17 1 21 5 17 9" />
					<path d="M3 11V9a4 4 0 0 1 4-4h14" />
					<polyline points="7 23 3 19 7 15" />
					<path d="M21 13v2a4 4 0 0 1-4 4H3" />
					<text x="9.5" y="15" font-size="8" fill="currentColor" stroke="none">1</text>
				</svg>
				<svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="17 1 21 5 17 9" />
					<path d="M3 11V9a4 4 0 0 1 4-4h14" />
					<polyline points="7 23 3 19 7 15" />
					<path d="M21 13v2a4 4 0 0 1-4 4H3" />
				</svg>
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
	width: 80px;
	height: 80px;
	background: var(--color-primary, var(--color-accent));
	color: oklch(0.18 0.02 35);
}
.ctrl-btn:focus-visible {
	transform: scale(1.08);
	background: oklch(1 0 0 / 0.18);
}
.ctrl-play:focus-visible {
	background: var(--color-primary, var(--color-accent));
	box-shadow: 0 0 0 4px oklch(1 0 0 / 0.6);
}
</style>
