// Every socket transition, per hub. A reconnect recorded as a failure made a
// hub that dropped and recovered read as a hub that never came back.
// See specs/nomercy-app-kmp/diagnostics-capture-everything.md.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { diagnosticsRing } from '@/lib/diagnostics/sink';

const { reconnecting, reconnected, closed, handlers, invalidatePlugins } = vi.hoisted(() => ({
	reconnecting: [] as Array<() => void>,
	reconnected: [] as Array<() => void>,
	closed: [] as Array<(error?: Error) => void>,
	handlers: new Map<string, (...args: unknown[]) => void>(),
	invalidatePlugins: vi.fn(),
}));

vi.mock('@/lib/signalr/connection', () => ({
	buildHub: () => ({
		start: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn().mockResolvedValue(undefined),
		on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
		off: vi.fn(),
		onreconnecting: (callback: () => void) => reconnecting.push(callback),
		onreconnected: (callback: () => void) => reconnected.push(callback),
		onclose: (callback: (error?: Error) => void) => closed.push(callback),
	}),
}));

vi.mock('@/lib/queryShim', () => ({
	invalidateAllLibrary: vi.fn(),
	invalidateFromServer: vi.fn(),
	invalidatePlugins,
}));

const { socketStore } = await import('./socketStore');
const { authStore } = await import('./authStore');

describe('socket transitions are recorded per hub', () => {
	beforeEach(() => {
		reconnecting.length = 0;
		reconnected.length = 0;
		closed.length = 0;
		diagnosticsRing.clear();
		authStore.serverUrl.value = 'https://media.example.test';
		authStore.accessToken.value = 'token';
	});

	it('records the attempt before each hub opens, so a slow connect is visible', async () => {
		await socketStore.connectAll();

		const codes = diagnosticsRing.snapshot().map(entry => `${entry.code} ${entry.label}`);
		expect(codes).toContain('SocketConnecting videoHub');
		expect(codes).toContain('SocketOpened videoHub');
		expect(codes).toContain('SocketConnecting musicHub');
		expect(codes).toContain('SocketConnecting deviceHub');
	});

	it('records a reconnect attempt as its own transition, not as a failure', async () => {
		await socketStore.connectAll();
		diagnosticsRing.clear();

		reconnecting.forEach(callback => callback());

		const entries = diagnosticsRing.snapshot();
		expect(entries.map(entry => entry.code)).toEqual([
			'SocketReconnecting',
			'SocketReconnecting',
			'SocketReconnecting',
			'SocketReconnecting',
		]);
		expect(entries.map(entry => entry.label)).toEqual(['videoHub', 'musicHub', 'deviceHub', 'pluginHub']);
	});

	it('records the recovery that follows a reconnect', async () => {
		await socketStore.connectAll();
		diagnosticsRing.clear();

		reconnected.forEach(callback => callback());

		expect(diagnosticsRing.snapshot().map(entry => entry.code)).toEqual([
			'SocketOpened',
			'SocketOpened',
			'SocketOpened',
			'SocketOpened',
		]);
	});

	it('records a close for every hub', async () => {
		await socketStore.connectAll();
		diagnosticsRing.clear();

		closed.forEach(callback => callback());

		expect(diagnosticsRing.snapshot().map(entry => entry.label)).toEqual([
			'videoHub',
			'musicHub',
			'deviceHub',
			'pluginHub',
		]);
	});

	it('re-reads every plugin answer when a plugin pushes', async () => {
		await socketStore.connectAll();
		invalidatePlugins.mockClear();

		handlers.get('PluginMessage')?.({ pluginId: 'radio', type: 'stations-changed' });

		expect(invalidatePlugins).toHaveBeenCalledTimes(1);
	});

	it('re-reads the plugin answers after the plugin socket comes back', async () => {
		await socketStore.connectAll();
		invalidatePlugins.mockClear();

		reconnected.forEach(callback => callback());

		// Once, for the plugin hub. Every push sent while the socket was down is
		// gone, and the other three hubs have nothing to say about plugins.
		expect(invalidatePlugins).toHaveBeenCalledTimes(1);
	});
});
