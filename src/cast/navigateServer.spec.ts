import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NAMESPACE_GENERAL } from './namespaces';
import { bootCastReceiver } from './receiver';
import { authStore } from '@/stores/authStore';

vi.mock('@/stores/socketStore', () => ({
	socketStore: { connectAll: vi.fn(async () => {}), disconnectAll: vi.fn(async () => {}) },
}));

type MessageListener = (event: { senderId?: string; data: unknown }) => void;

const FirstServer = { id: '00000000-0000-4000-8000-000000000001', serverBaseUrl: 'https://192-0-2-10.example.invalid:7626' };
const SecondServer = { id: '00000000-0000-4000-8000-000000000002', serverBaseUrl: 'https://198-51-100-20.example.invalid:7626' };
const WatchRoute = '/tv/60808/watch?cast=true&position=0';

function jwt(): string {
	const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
	return `${part({ alg: 'none' })}.${part({ sub: '00000000-0000-4000-8000-000000000009', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

function installFakeCast(): MessageListener[] {
	const listeners: MessageListener[] = [];
	const context = {
		addEventListener: vi.fn(),
		addCustomMessageListener: (ns: string, fn: MessageListener) => {
			if (ns === NAMESPACE_GENERAL)
				listeners.push(fn);
		},
		sendCustomMessage: vi.fn(),
		getApplicationData: vi.fn(),
		getSenders: () => [],
		start: vi.fn(),
	};
	vi.stubGlobal('cast', {
		framework: {
			CastReceiverContext: { getInstance: () => context },
			CastReceiverOptions: class {},
			system: { MessageType: { JSON: 'JSON' } },
		},
	});
	return listeners;
}

/** app_config lists both servers; a probe answers only for a server in `reachable`. */
function stubNetwork(reachable: string[]): void {
	vi.stubGlobal('fetch', vi.fn(async (url: string) => {
		if (url.endsWith('/v1/app_config'))
			return new Response(JSON.stringify({ data: { servers: [FirstServer, SecondServer] } }), { status: 200 });
		if (reachable.some(base => url.startsWith(base)))
			return new Response('{}', { status: 200 });
		throw new TypeError('Failed to fetch');
	}));
}

/** Plays the phone: one navigate message, then the route the receiver opened. */
async function castFromPhone(server: { server_id?: string; server_url?: string }): Promise<ReturnType<typeof vi.fn>> {
	const push = vi.fn(async () => {});
	const listeners = installFakeCast();
	bootCastReceiver({ push } as never);
	for (const fn of listeners)
		fn({ senderId: 'sender-1', data: { route: WatchRoute, token: jwt(), ...server } });
	return push;
}

describe('a cast from the phone plays from the right media server (cast-player#64)', () => {
	beforeEach(() => {
		window.sessionStorage.removeItem('nm_cast_mock');
		authStore.clear();
		authStore.receiverState.value = 'LOADING';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('uses the app_config server the phone names by server_id', async () => {
		stubNetwork([FirstServer.serverBaseUrl, SecondServer.serverBaseUrl]);

		const push = await castFromPhone({ server_id: SecondServer.id });

		await vi.waitFor(() => expect(push).toHaveBeenCalledWith(WatchRoute));
		expect(authStore.serverUrl.value).toBe(SecondServer.serverBaseUrl);
		expect(authStore.serverId.value).toBe(SecondServer.id);
	});

	it('uses the app_config server whose address the phone names by server_url', async () => {
		stubNetwork([FirstServer.serverBaseUrl, SecondServer.serverBaseUrl]);

		const push = await castFromPhone({ server_url: `${SecondServer.serverBaseUrl}/` });

		await vi.waitFor(() => expect(push).toHaveBeenCalledWith(WatchRoute));
		expect(authStore.serverUrl.value).toBe(SecondServer.serverBaseUrl);
		expect(authStore.serverId.value).toBe(SecondServer.id);
	});

	// The token goes to the server in use: a sender may only pick one of the account's own.
	it('ignores a server_url that is not one of the account\'s servers', async () => {
		stubNetwork([SecondServer.serverBaseUrl, 'https://203-0-113-30.example.invalid:7626']);

		const push = await castFromPhone({ server_url: 'https://203-0-113-30.example.invalid:7626' });

		await vi.waitFor(() => expect(push).toHaveBeenCalledWith(WatchRoute));
		expect(authStore.serverUrl.value).toBe(SecondServer.serverBaseUrl);
	});

	it('shows the recast screen when app_config fails, even with a server_url', async () => {
		vi.stubGlobal('fetch', vi.fn(async (url: string) => {
			if (url.endsWith('/v1/app_config'))
				throw new TypeError('Failed to fetch');
			return new Response('{}', { status: 200 });
		}));

		const push = await castFromPhone({ server_url: SecondServer.serverBaseUrl });

		await vi.waitFor(() => expect(authStore.receiverState.value).toBe('DEGRADED'));
		expect(authStore.serverUrl.value).toBeNull();
		expect(push).not.toHaveBeenCalled();
	});

	// @spec CAST-002
	it('skips an unreachable first server when the phone names none', async () => {
		stubNetwork([SecondServer.serverBaseUrl]);

		const push = await castFromPhone({});

		await vi.waitFor(() => expect(push).toHaveBeenCalledWith(WatchRoute));
		expect(authStore.serverUrl.value).toBe(SecondServer.serverBaseUrl);
	});

	// @spec CAST-001
	it('keeps the first server when every server answers', async () => {
		stubNetwork([FirstServer.serverBaseUrl, SecondServer.serverBaseUrl]);

		const push = await castFromPhone({});

		await vi.waitFor(() => expect(push).toHaveBeenCalledWith(WatchRoute));
		expect(authStore.serverUrl.value).toBe(FirstServer.serverBaseUrl);
	});

	it('shows the recast screen when no server answers', async () => {
		stubNetwork([]);

		const push = await castFromPhone({});

		await vi.waitFor(() => expect(authStore.receiverState.value).toBe('DEGRADED'));
		expect(push).not.toHaveBeenCalled();
	});
});
