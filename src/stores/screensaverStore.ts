import { ref, watch } from 'vue';
import { playbackStore } from './playbackStore';
import { settingsStore } from './settingsStore';

/**
 * Idle / screensaver state per spec §12.11.
 *
 * - Idle timer resets on every D-pad keydown via useDPad.
 * - After the account's screensaverDelay minutes the screensaver activates (UI dims to ambient).
 * - During active video playback the screensaver is SUPPRESSED — user
 *   is intentionally watching even without interacting.
 * - Music keeps playing during screensaver; the album-art hero stays
 *   visible as ambient art (Spotify style).
 */

const active = ref(false);
let idleTimer: number | null = null;

function clearTimer(): void {
	if (idleTimer !== null) {
		window.clearTimeout(idleTimer);
		idleTimer = null;
	}
}

function resetIdle(): void {
	active.value = false;
	clearTimer();

	idleTimer = window.setTimeout(() => {
		if (playbackStore.video.playing.value) return;

		active.value = true;
	}, settingsStore.screensaverDelay.value * 60_000);
}

function deactivate(): void {
	active.value = false;
	clearTimer();
}

// ScreensaverStore.kt:184-189: sequential and wrapping; the first advance leaves index 0 behind.
let index = 0;

function advanceIndex(length: number): number {
	index = index + 1 >= length
		? 0
		: index + 1;

	return index;
}

function resetIndex(): void {
	index = 0;
}

// ScreensaverStore.kt:103-124: playing disables it, stopping restarts the countdown.
watch(playbackStore.video.playing, (playing) => {
	if (playing) {
		deactivate();

		return;
	}

	resetIdle();
});

export const screensaverStore = {
	active,
	resetIdle,
	deactivate,
	advanceIndex,
	resetIndex,
};
