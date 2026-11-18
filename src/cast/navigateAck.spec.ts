import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NAMESPACE_GENERAL } from './namespaces';

vi.mock('@/stores/socketStore', () => ({
	socketStore: { connectAll: vi.fn(async () => {}), disconnectAll: vi.fn(async () => {}) },
}));

let bootCastReceiver: typeof import('./receiver').bootCastReceiver;
let authStore: typeof import('@/stores/authStore').authStore;
let socketStore: typeof import('@/stores/socketStore').socketStore;

// The message bus keeps its handlers per module, so each test loads a fresh one.
async function loadFresh(): Promise<void> {
	vi.resetModules();
	({ bootCastReceiver } = await import('./receiver'));
	({ authStore } = await import('@/stores/authStore'));
	({ socketStore } = await import('@/stores/socketStore'));
}

type Listener = (event: { senderId?: string; data: unknown }) => void;

const Server = { id: '00000000-0000-4000-8000-000000000001', serverBaseUrl: 'https://192-0-2-10.example.invalid:7626' };
const WatchRoute = '/tv/60808/watch?cast=true&position=0';

function jwt(): string {
	const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

	return `${part({ alg: 'none' })}.${part({ sub: '00000000-0000-4000-8000-000000000009', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

function stubNetwork(): void {
	vi.stubGlobal('fetch', vi.fn((url: string) => {
		const body = url.endsWith('/v1/app_config')
			? JSON.stringify({ data: { servers: [Server] } })
			: '{}';

		return Promise.resolve(new Response(body, { status: 200 }));
	}));
}

function fakeRouter(knownRoute = true) {
	return {
		push: vi.fn(async () => {}),
		resolve: vi.fn(() => ({ matched: knownRoute
			? [{ path: '/tv/:id/watch' }]
			: [{ path: '/:pathMatch(.*)*' }] })),
	};
}

function cast(data: object, router = fakeRouter()) {
	const listeners: Listener[] = [];
	const send = vi.fn();
	const context = {
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
	};

	vi.stubGlobal('cast', {
		framework: {
			CastReceiverContext: { getInstance: () => context },
			CastReceiverOptions: class {},
			system: { MessageType: { JSON: 'JSON' } },
		},
	});

	bootCastReceiver(router as never);

	for (const fn of listeners) {
		fn({ senderId: 'sender-1', data });
	}

	return { send, router };
}

function acked(send: ReturnType<typeof vi.fn>): boolean {
	return send.mock.calls.some((call) => (call[2] as { ack?: boolean }).ack === true);
}

describe('the receiver acks a navigate only after the TV accepted it, as native CastNavigateChannel does', () => {
	beforeEach(async () => {
		await loadFresh();
		vi.useFakeTimers();
		window.sessionStorage.removeItem('nm_cast_mock');
		authStore.clear();
		authStore.bootError.value = null;
		vi.mocked(socketStore.connectAll).mockReset().mockResolvedValue(undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		stubNetwork();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('acks a valid route once the route opened (positive control)', async () => {
		const { send, router } = cast({
			route: WatchRoute,
			token: jwt(),
			server_id: Server.id,
		});

		await vi.advanceTimersByTimeAsync(2000);
		expect(router.push).toHaveBeenCalledWith(WatchRoute);

		expect(send).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-1', {
			ack: true,
			route: WatchRoute,
			visible: true,
			device_id: expect.any(String),
		});
	});

	it('names the music hub client id in the ack, so the phone can hand music to this TV', async () => {
		const { castDeviceId } = await import('@/lib/diagnostics/deviceId');
		const { send } = cast({
			route: WatchRoute,
			token: jwt(),
			server_id: Server.id,
		});

		await vi.advanceTimersByTimeAsync(2000);

		expect(send).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-1', {
			ack: true,
			route: WatchRoute,
			visible: true,
			device_id: castDeviceId(),
		});
	});

	it('tells the phone the page is hidden when the TV keeps it behind its launcher', async () => {
		vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
		const { send } = cast({
			route: WatchRoute,
			token: jwt(),
			server_id: Server.id,
		});

		await vi.advanceTimersByTimeAsync(2000);

		expect(send).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-1', {
			ack: true,
			route: WatchRoute,
			visible: false,
			device_id: expect.any(String),
		});
	});

	it('does not ack a route with no token', async () => {
		const { send, router } = cast({ route: WatchRoute });

		await vi.advanceTimersByTimeAsync(2000);
		expect(acked(send)).toBe(false);
		expect(router.push).not.toHaveBeenCalled();
	});

	it('does not ack a route without a leading slash', async () => {
		const { send } = cast({ route: 'tv/60808/watch', token: jwt() });

		await vi.advanceTimersByTimeAsync(2000);
		expect(acked(send)).toBe(false);
	});

	it('does not ack when the named server is not on the account', async () => {
		const { send, router } = cast({
			route: WatchRoute,
			token: jwt(),
			server_id: '00000000-0000-4000-8000-0000000000ff',
		});

		await vi.advanceTimersByTimeAsync(2000);
		expect(acked(send)).toBe(false);
		expect(router.push).not.toHaveBeenCalled();
	});

	it('does not ack a route the receiver does not know', async () => {
		const { send, router } = cast({
			route: '/bogus',
			token: jwt(),
			server_id: Server.id,
		}, fakeRouter(false));

		await vi.advanceTimersByTimeAsync(2000);
		expect(acked(send)).toBe(false);
		expect(router.push).not.toHaveBeenCalled();
	});

	it('does not ack when the router refuses the route, and does not throw unhandled', async () => {
		const router = fakeRouter();

		router.push.mockRejectedValue(new Error('chunk failed'));
		const { send } = cast({
			route: WatchRoute,
			token: jwt(),
			server_id: Server.id,
		}, router);

		await vi.advanceTimersByTimeAsync(2000);
		expect(acked(send)).toBe(false);
	});
});

describe('a remote stop leaves the watch screen, as native WatchScreen.kt does for a cast', () => {
	beforeEach(async () => {
		await loadFresh();
		window.sessionStorage.removeItem('nm_cast_mock');
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	function stopOn(path: string) {
		const router = {
			...fakeRouter(),
			replace: vi.fn(async () => {}),
			back: vi.fn(),
			currentRoute: { value: { path } },
		};
		const { send } = cast({ control: {
			id: 1,
			method: 'POST',
			path: '/v1/session/transport/stop',
		} }, router as never);

		return { router, send };
	}

	it('goes back from a watch route', async () => {
		const { router, send } = stopOn('/tv/60808/watch');

		await vi.waitFor(() => expect(send).toHaveBeenCalled());
		expect(router.replace).toHaveBeenCalledWith('/');
	});

	it('stays put when the receiver is not on a watch route', async () => {
		const { router, send } = stopOn('/music');

		await vi.waitFor(() => expect(send).toHaveBeenCalled());
		expect(router.replace).not.toHaveBeenCalled();
		expect(router.back).not.toHaveBeenCalled();
	});
});

describe('playback does not wait on the SignalR hubs', () => {
	beforeEach(async () => {
		await loadFresh();
		vi.useFakeTimers();
		window.sessionStorage.removeItem('nm_cast_mock');
		authStore.clear();
		authStore.bootError.value = null;
		const never = new Promise<void>(() => {});

		vi.mocked(socketStore.connectAll).mockReset().mockReturnValue(never);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		stubNetwork();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('keeps the watch route and shows no boot error when a hub never connects', async () => {
		const { router, send } = cast({
			route: WatchRoute,
			token: jwt(),
			server_id: Server.id,
		});

		await vi.advanceTimersByTimeAsync(20_000);
		expect(router.push).toHaveBeenCalledWith(WatchRoute);
		expect(authStore.bootError.value).toBeNull();
		expect(authStore.receiverState.value).toBe('READY');
		expect(socketStore.disconnectAll).not.toHaveBeenCalled();
		expect(acked(send)).toBe(true);
	});
});
