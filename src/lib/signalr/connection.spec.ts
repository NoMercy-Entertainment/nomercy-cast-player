// The server keys a hub connection to a device by the client_* query params;
// without them the receiver is an anonymous socket and never gets a volume.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { castDeviceId } from '@/lib/diagnostics/deviceId';

const { withUrl } = vi.hoisted(() => ({ withUrl: vi.fn() }));

vi.mock('@microsoft/signalr', () => {
	const builder = {
		withUrl: (...args: unknown[]) => {
			withUrl(...args);
			return builder;
		},
		withAutomaticReconnect: () => builder,
		configureLogging: () => builder,
		build: () => ({}),
	};
	return {
		HttpTransportType: { WebSockets: 1 },
		LogLevel: { Warning: 3 },
		HubConnectionBuilder: function HubConnectionBuilder() {
			return builder;
		},
	};
});

const { buildHub } = await import('./connection');
const { authStore } = await import('@/stores/authStore');

describe('buildHub identifies the receiver to the server', () => {
	beforeEach(() => {
		withUrl.mockClear();
		authStore.serverUrl.value = 'https://media.example.test/';
	});

	it.each(['videoHub', 'musicHub', 'deviceHub', 'pluginHub'] as const)('sends client_id, client_name and client_type on the %s url', (name) => {
		buildHub(name);

		const url = new URL(withUrl.mock.calls[0]![0] as string);
		expect(url.origin + url.pathname).toBe(`https://media.example.test/${name}`);
		expect(url.searchParams.get('client_id')).toBe(castDeviceId());
		expect(url.searchParams.get('client_name')).toBeTruthy();
		expect(url.searchParams.get('client_type')).toBe('tv');
	});
});
