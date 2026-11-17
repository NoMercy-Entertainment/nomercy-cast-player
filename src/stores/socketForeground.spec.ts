import { describe, expect, it, vi } from 'vitest';

const { invalidateAllLibrary } = vi.hoisted(() => ({ invalidateAllLibrary: vi.fn() }));

vi.mock('@/lib/queryShim', async (importActual) => ({
	...(await importActual<typeof import('@/lib/queryShim')>()),
	invalidateAllLibrary,
}));

describe('foreground resume', () => {
	it('refreshes the library even while the hub is still reconnecting', async () => {
		const { onForegroundResume, socketStore } = await import('./socketStore');

		socketStore.connectionState.value = 'reconnecting';
		onForegroundResume();

		// NoMercyApplication.kt:765-777 gates on the time away only, never on the socket.
		expect(invalidateAllLibrary).toHaveBeenCalledTimes(1);
	});
});
