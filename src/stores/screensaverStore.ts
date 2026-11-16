import { ref } from 'vue';
import { playbackStore } from './playbackStore';

/**
 * Idle / screensaver state per spec §12.11.
 *
 * - Idle timer resets on every D-pad keydown via useDPad.
 * - At IDLE_TIMEOUT_MS the screensaver activates (UI dims to ambient).
 * - During active video playback the screensaver is SUPPRESSED — user
 *   is intentionally watching even without interacting.
 * - Music keeps playing during screensaver; the album-art hero stays
 *   visible as ambient art (Spotify style).
 */

const IDLE_TIMEOUT_MS = 5 * 60_000;

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
	}, IDLE_TIMEOUT_MS);
}

function deactivate(): void {
	active.value = false;
	clearTimer();
}

export const screensaverStore = {
	active,
	resetIdle,
	deactivate,
};
