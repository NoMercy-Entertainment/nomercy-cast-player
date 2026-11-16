import { onBeforeUnmount, onMounted } from 'vue';

/**
 * requestIdleCallback wrapper with setTimeout fallback for browsers that
 * don't expose it (some smart-TV embedded WebViews). Idle-fenced work in
 * the receiver: image preload, telemetry, cache warming, retries.
 */

interface IdleHandle {
	cancel: () => void;
}

export function scheduleIdle(
	callback: () => void,
	options: { timeout?: number } = {},
) {
	// Some smart-TV embedded WebViews don't expose requestIdleCallback even
	// though @types/dom declares it as required. Feature-detect on window.
	const w = window as unknown as Record<string, unknown>;

	if (typeof w.requestIdleCallback === 'function') {
		const ric = w.requestIdleCallback as (
			cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
			opts?: { timeout?: number },
		) => number;
		const cancel = w.cancelIdleCallback as ((handle: number) => void) | undefined;
		const id = ric(() => callback(), { timeout: options.timeout ?? 1000 });

		return {
			cancel: () => {
				if (typeof cancel === 'function') {
					cancel(id);
				}
			},
		} as const satisfies IdleHandle;
	}

	const id = window.setTimeout(callback, 0);

	return { cancel: () => window.clearTimeout(id) } as const satisfies IdleHandle;
}

/**
 * Vue-component-scoped idle callback. Auto-cancels on unmount.
 */
export function useIdleCallback(callback: () => void, options: { timeout?: number } = {}): void {
	let handle: IdleHandle | null = null;

	onMounted(() => {
		handle = scheduleIdle(callback, options);
	});

	onBeforeUnmount(() => {
		handle?.cancel();
	});
}
