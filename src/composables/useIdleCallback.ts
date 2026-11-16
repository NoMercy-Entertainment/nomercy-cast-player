import { onBeforeUnmount, onMounted } from 'vue';

/**
 * requestIdleCallback wrapper with setTimeout fallback for browsers that
 * don't expose it (some smart-TV embedded WebViews). Idle-fenced work in
 * the receiver: image preload, telemetry, cache warming, retries.
 */

interface IdleHandle {
	cancel: () => void;
}

interface OptionalIdleApi {
	requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
	cancelIdleCallback?: (handle: number) => void;
}

export function scheduleIdle(
	callback: () => void,
	options: { timeout?: number } = {},
) {
	// Some smart-TV embedded WebViews don't expose requestIdleCallback even
	// though @types/dom declares it as required. Feature-detect on window.
	const w: OptionalIdleApi = window;

	if (typeof w.requestIdleCallback === 'function') {
		const id = w.requestIdleCallback(() => callback(), { timeout: options.timeout ?? 1000 });

		return {
			cancel: () => {
				if (typeof w.cancelIdleCallback === 'function') {
					w.cancelIdleCallback(id);
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
