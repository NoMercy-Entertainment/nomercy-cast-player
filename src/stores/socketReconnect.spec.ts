// A second cast calls connectAll again while the first cast's hubs still run.
// Native keeps one live player; here the old hubs must end, not pile up.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { built, down } = vi.hoisted(() => ({
	built: [] as Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>,
	down: { value: false },
}));

vi.mock('@/lib/signalr/connection', () => ({
	buildHub: () => {
		const hub = {
			start: vi.fn(() =>
				down.value
					? Promise.reject(new Error('down'))
					: Promise.resolve()),
			stop: vi.fn().mockResolvedValue(undefined),
			on: vi.fn(),
			off: vi.fn(),
			onreconnecting: vi.fn(),
			onreconnected: vi.fn(),
			onclose: vi.fn(),
		};

		built.push(hub);

		return hub;
	},
}));

const { socketStore } = await import('./socketStore');
const { authStore } = await import('./authStore');

describe('connectAll twice leaves one set of hubs', () => {
	beforeEach(() => {
		built.length = 0;
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		authStore.serverUrl.value = 'https://media.example.test';
		authStore.accessToken.value = 'token';
	});

	afterEach(async () => {
		await socketStore.disconnectAll();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('stops the first set of hubs', async () => {
		await socketStore.connectAll();
		const first = built.slice(0, 4);

		await socketStore.connectAll();

		expect(built).toHaveLength(8);

		for (const hub of first) {
			expect(hub.stop).toHaveBeenCalled();
		}
	});

	it('ends the retry loop of a hub that never started', async () => {
		down.value = true;
		void socketStore.connectAll();

		await vi.advanceTimersByTimeAsync(6000);
		const old = built.slice(0, 4);
		const before = old.map((hub) => hub.start.mock.calls.length);

		expect(before.every((count) => count >= 2)).toBe(true);
		down.value = false;
		await socketStore.connectAll();
		await vi.advanceTimersByTimeAsync(30_000);

		expect(old.map((hub) => hub.start.mock.calls.length)).toEqual(before);
	});
});
