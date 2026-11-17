import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NAMESPACE_GENERAL } from './namespaces';

vi.mock('@/stores/socketStore', () => ({
	socketStore: { connectAll: vi.fn(async () => {}), disconnectAll: vi.fn(async () => {}) },
}));

type Listener = (event: { senderId?: string; data: unknown }) => void;

const Server = { id: '00000000-0000-4000-8000-000000000001', serverBaseUrl: 'https://192-0-2-10.example.invalid:7626' };

function jwt(): string {
	const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

	return `${part({ alg: 'none' })}.${part({ sub: '00000000-0000-4000-8000-000000000009', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

// The receiver with the app's own router, as the TV runs it: a sender resends its navigate
// until it is acked, and the TV must still answer.
describe('a navigate is acked with the real router', () => {
	beforeEach(() => {
		vi.resetModules();
		window.sessionStorage.removeItem('nm_cast_mock');
		vi.spyOn(console, 'warn').mockImplementation(() => {});

		const answer = (url: string): Response => new Response(
			url.endsWith('/v1/app_config')
				? JSON.stringify({ data: { servers: [Server] } })
				: '{}',
			{ status: 200 },
		);

		vi.stubGlobal('fetch', vi.fn(async (url: string) => answer(url)));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	async function boot() {
		const { bootCastReceiver } = await import('./receiver');
		const { router } = await import('@/router');
		const listeners: Listener[] = [];
		const send = vi.fn();

		vi.stubGlobal('cast', {
			framework: {
				CastReceiverContext: { getInstance: () => ({
					addEventListener: vi.fn(),
					addCustomMessageListener: (ns: string, fn: Listener) => {
						if (ns === NAMESPACE_GENERAL) {
							listeners.push(fn);
						}
					},
					sendCustomMessage: send,
					getApplicationData: vi.fn(),
					getSenders: () => [],
					start: vi.fn(),
				}) },
				CastReceiverOptions: class {},
				system: { MessageType: { JSON: 'JSON' } },
			},
		});

		bootCastReceiver(router);
		await router.push('/splash').catch(() => {});

		const deliver = (data: object): void => {
			for (const fn of listeners) {
				fn({ senderId: 'sender-1', data });
			}
		};

		return { send, deliver };
	}

	const acks = (send: ReturnType<typeof vi.fn>) =>
		send.mock.calls.filter((call) => (call[2] as { ack?: boolean }).ack === true);

	it('acks one navigate to /libraries', async () => {
		const { send, deliver } = await boot();

		deliver({
			route: '/libraries',
			token: jwt(),
			server_id: Server.id,
		});

		await vi.waitFor(() => expect(acks(send).length).toBeGreaterThan(0), { timeout: 5000 });
	});

	it('acks when the same navigate arrives again while the first is still booting', async () => {
		const { send, deliver } = await boot();
		const payload = {
			route: '/libraries',
			token: jwt(),
			server_id: Server.id,
		};

		deliver(payload);
		deliver(payload);
		deliver(payload);
		await vi.waitFor(() => expect(acks(send).length).toBe(3), { timeout: 5000 });
	});

	it('boots again for the same navigate once the first one ended', async () => {
		const { send, deliver } = await boot();
		const payload = {
			route: '/libraries',
			token: jwt(),
			server_id: Server.id,
		};

		deliver(payload);
		await vi.waitFor(() => expect(acks(send).length).toBe(1), { timeout: 5000 });
		deliver(payload);
		await vi.waitFor(() => expect(acks(send).length).toBe(2), { timeout: 5000 });
	});
});
