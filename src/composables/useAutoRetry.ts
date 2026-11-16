import { onBeforeUnmount, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * Auto-retry a query while it's in an error state. Mirrors APK
 * TvHomeScreen / LibraryScreen / MusicStartScreen — every 15s the
 * query refetches itself so the screen recovers automatically when
 * the server comes back online without the user pressing "Try Again".
 */

interface AutoRetryOptions {
	error: Ref<Error | null | undefined>;
	refetch: () => void;
	intervalMs?: number;
}

export function useAutoRetry(opts: AutoRetryOptions): void {
	const interval = opts.intervalMs ?? 15_000;
	let timer: number | null = null;

	watch(opts.error, (next) => {
		if (next) {
			if (timer === null) {
				timer = window.setInterval(() => {
					opts.refetch();
				}, interval);
			}
		} else if (timer !== null) {
			window.clearInterval(timer);
			timer = null;
		}
	});

	onBeforeUnmount(() => {
		if (timer !== null) {
			window.clearInterval(timer);
		}
	});
}
