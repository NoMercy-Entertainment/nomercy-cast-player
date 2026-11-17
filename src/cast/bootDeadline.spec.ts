import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NAMESPACE_GENERAL } from './namespaces';
import { bootCastReceiver } from './receiver';
import { authStore } from '@/stores/authStore';
import { socketStore } from '@/stores/socketStore';

vi.mock('@/stores/socketStore', () => ({
	socketStore: { connectAll: vi.fn(async () => {}), disconnectAll: vi.fn(async () => {}) },
}));

type MessageListener = (event: { senderId?: string; data: unknown }) => void;

const Server = { id: '00000000-0000-4000-8000-000000000001', serverBaseUrl: 'https://192-0-2-10.example.invalid:7626' };
const OtherServer = { id: '00000000-0000-4000-8000-000000000002', serverBaseUrl: 'https://198-51-100-20.example.invalid:7626' };
const WatchRoute = '/tv/60808/watch?cast=true&position=0';
const NeverSettles = new Promise<Response>(() => {});

function jwt(): string {
	const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

	return `${part({ alg: 'none' })}.${part({ sub: '00000000-0000-4000-8000-000000000009', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

function installFakeCast(): MessageListener[] {
	const listeners: MessageListener[] = [];
	const context = {
		addEventListener: vi.fn(),
		addCustomMessageListener: (ns: string, fn: MessageListener) => {
			if (ns === NAMESPACE_GENERAL) {
				listeners.push(fn);
			}
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

/** app_config lists `servers`; a probe answers for a base in `reachable`, hangs for one in `hung`, else fails. */
function stubNetwork(servers: object[], reachable: () => string[], hung: string[] = []): void {
	vi.stubGlobal('fetch', vi.fn((url: string) => {
		if (url.endsWith('/v1/app_config')) {
			const config = new Response(JSON.stringify({ data: { servers } }), { status: 200 });

			return Promise.resolve(config);
		}

		if (hung.some((base) => url.startsWith(base)))
			return NeverSettles;

		if (reachable().some((base) => url.startsWith(base)))
			return Promise.resolve(new Response('{}', { status: 200 }));

		return Promise.reject(new TypeError('Failed to fetch'));
	}));
}

const LaunchData = {
	access_token: '',
	user_id: '00000000-0000-4000-8000-000000000001',
	server_id: Server.id,
	server_url: Server.serverBaseUrl,
	device_id: '00000000-0000-4000-8000-000000000003',
	intent: {
		type: 'play_video',
		media_type: 'tv',
		media_id: '74204',
		season: 1,
		episode: 1,
		resume_at: 12,
	},
};

/** The media server wakes the TV: CAF `ready`, then a launch message with the token and server. */
function launchFromServer(): ReturnType<typeof vi.fn> {
	const push = vi.fn(async () => {});
	const ready: (() => void)[] = [];
	const messages: MessageListener[] = [];
	const context = {
		addEventListener: (type: string, fn: () => void) => {
			if (type === 'ready') {
				ready.push(fn);
			}
		},
		addCustomMessageListener: (ns: string, fn: MessageListener) => {
			if (ns === NAMESPACE_GENERAL) {
				messages.push(fn);
			}
		},
		sendCustomMessage: vi.fn(),
		getApplicationData: () => ({
			id: 'x',
			name: 'x',
			sessionId: 1,
			launchingSenderId: 'sender-0',
			namespaces: [],
		}),
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

	bootCastReceiver({ push, resolve: () => ({ matched: [{ path: '/tv/:id/watch' }] }) } as never);

	for (const fn of ready) {
		fn();
	}

	for (const fn of messages) {
		fn({ senderId: 'sender-0', data: { launch: { ...LaunchData, access_token: jwt() } } });
	}

	return push;
}

/** The dev hatch: a mock session in sessionStorage, no CAF SDK. */
function mockCast(serverUrl?: string): ReturnType<typeof vi.fn> {
	const push = vi.fn(async () => {});

	window.sessionStorage.setItem('nm_cast_mock', JSON.stringify({
		token: jwt(),
		route: WatchRoute,
		serverUrl,
	}));

	bootCastReceiver({ push, resolve: () => ({ matched: [{ path: '/tv/:id/watch' }] }) } as never);

	return push;
}

function castFromPhone(server: { server_id?: string } = {}): ReturnType<typeof vi.fn> {
	const push = vi.fn(async () => {});
	const listeners = installFakeCast();

	bootCastReceiver({ push, resolve: () => ({ matched: [{ path: '/tv/:id/watch' }] }) } as never);

	for (const fn of listeners) {
		fn({ senderId: 'sender-1', data: {
			route: WatchRoute,
			token: jwt(),
			...server,
		} });
	}

	return push;
}

describe('a stuck boot ends on the error screen, never an endless splash', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		window.sessionStorage.removeItem('nm_cast_mock');
		authStore.clear();
		authStore.bootError.value = null;
		authStore.receiverState.value = 'LOADING';
		vi.mocked(socketStore.connectAll).mockReset().mockResolvedValue(undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('reaches the route and READY well before 15 s, with no error (positive control)', async () => {
		stubNetwork([Server], () => [Server.serverBaseUrl]);

		const push = castFromPhone({ server_id: Server.id });

		await vi.advanceTimersByTimeAsync(2000);
		expect(push).toHaveBeenCalledWith(WatchRoute);
		expect(authStore.receiverState.value).toBe('READY');
		await vi.advanceTimersByTimeAsync(20_000);
		expect(authStore.bootError.value).toBeNull();
		expect(authStore.receiverState.value).toBe('READY');
	});

	it('shows the server reason after 15 s when the named server never answers', async () => {
		stubNetwork([Server], () => [], [Server.serverBaseUrl]);

		const push = castFromPhone({ server_id: Server.id });

		await vi.advanceTimersByTimeAsync(14_000);
		expect(authStore.bootError.value).toBeNull();
		await vi.advanceTimersByTimeAsync(1500);
		expect(authStore.bootError.value).toBe('The media server does not answer.');
		expect(push).not.toHaveBeenCalled();
	});

	it('stays on the named server when it does not answer, as KMP does (ServerSelectionLogic.kt:102-107)', async () => {
		stubNetwork([Server, OtherServer], () => [OtherServer.serverBaseUrl]);

		castFromPhone({ server_id: Server.id });

		await vi.advanceTimersByTimeAsync(6000);
		expect(authStore.serverUrl.value).toBe(Server.serverBaseUrl);
	});

	// Native never waits on a hub (WatchScreen.kt loads the playlist over HTTP).
	it('plays on when connectAll never settles, with no error screen', async () => {
		stubNetwork([Server], () => [Server.serverBaseUrl]);
		vi.mocked(socketStore.connectAll).mockImplementation(() => new Promise<void>(() => {}));

		const push = castFromPhone({ server_id: Server.id });

		await vi.advanceTimersByTimeAsync(16_000);
		expect(push).toHaveBeenCalledWith(WatchRoute);
		expect(authStore.bootError.value).toBeNull();
		expect(authStore.receiverState.value).toBe('READY');
	});

	it('shows the account reason after 15 s when app_config never answers', async () => {
		vi.stubGlobal('fetch', vi.fn(() => NeverSettles));

		castFromPhone();

		await vi.advanceTimersByTimeAsync(15_500);
		expect(authStore.bootError.value).toBe('The account service did not answer.');
	});

	it('try again reruns the boot with the same payload and reaches the route', async () => {
		let up = false;

		stubNetwork([Server], () =>
			up
				? [Server.serverBaseUrl]
				: [], [Server.serverBaseUrl]);

		const push = castFromPhone({ server_id: Server.id });

		await vi.advanceTimersByTimeAsync(15_500);
		expect(authStore.bootError.value).not.toBeNull();

		up = true;
		stubNetwork([Server], () => [Server.serverBaseUrl]);
		authStore.retryBoot();
		await vi.advanceTimersByTimeAsync(2000);

		expect(authStore.bootError.value).toBeNull();
		expect(push).toHaveBeenCalledWith(WatchRoute);
		expect(authStore.receiverState.value).toBe('READY');
	});

	it('a launch from the media server reaches READY when the connection opens (positive control)', async () => {
		launchFromServer();

		await vi.advanceTimersByTimeAsync(2000);
		expect(authStore.receiverState.value).toBe('READY');
		await vi.advanceTimersByTimeAsync(20_000);
		expect(authStore.bootError.value).toBeNull();
	});

	it('a launch from the media server plays on when connectAll never settles', async () => {
		vi.mocked(socketStore.connectAll).mockImplementation(() => new Promise<void>(() => {}));

		const push = launchFromServer();

		await vi.advanceTimersByTimeAsync(16_000);
		expect(push).toHaveBeenCalledTimes(1);
		expect(authStore.bootError.value).toBeNull();
		expect(authStore.receiverState.value).toBe('READY');
	});

	it('try again after a launch failure reruns the launch and reaches READY', async () => {
		vi.mocked(socketStore.connectAll).mockImplementationOnce(() => new Promise<void>(() => {}));

		const push = launchFromServer();

		await vi.advanceTimersByTimeAsync(2000);
		authStore.retryBoot();
		await vi.advanceTimersByTimeAsync(2000);
		expect(authStore.bootError.value).toBeNull();
		expect(authStore.receiverState.value).toBe('READY');
		expect(push).toHaveBeenCalledTimes(2);
	});

	it('a mock session reaches the route and READY when the server answers (positive control)', async () => {
		const push = mockCast(Server.serverBaseUrl);

		await vi.advanceTimersByTimeAsync(2000);
		expect(push).toHaveBeenCalledWith(WatchRoute);
		expect(authStore.receiverState.value).toBe('READY');
		expect(authStore.bootError.value).toBeNull();
	});

	it('a mock session plays on when connectAll never settles', async () => {
		vi.mocked(socketStore.connectAll).mockImplementation(() => new Promise<void>(() => {}));

		const push = mockCast(Server.serverBaseUrl);

		await vi.advanceTimersByTimeAsync(15_500);
		expect(push).toHaveBeenCalledWith(WatchRoute);
		expect(authStore.bootError.value).toBeNull();
	});

	it('a mock session shows the account reason after 15 s when app_config never answers', async () => {
		vi.stubGlobal('fetch', vi.fn(() => NeverSettles));

		mockCast();

		await vi.advanceTimersByTimeAsync(15_500);
		expect(authStore.bootError.value).toBe('The account service did not answer.');
	});

	it('a second failure shows the screen again', async () => {
		stubNetwork([Server], () => [], [Server.serverBaseUrl]);

		castFromPhone({ server_id: Server.id });
		await vi.advanceTimersByTimeAsync(15_500);
		expect(authStore.bootError.value).not.toBeNull();

		authStore.retryBoot();
		await vi.advanceTimersByTimeAsync(100);
		expect(authStore.bootError.value).toBeNull();
		await vi.advanceTimersByTimeAsync(15_500);
		expect(authStore.bootError.value).toBe('The media server does not answer.');
	});
});
