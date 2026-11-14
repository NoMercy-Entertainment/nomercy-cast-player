import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bootCastReceiver } from './receiver';
import { authStore } from '@/stores/authStore';

vi.mock('@/stores/socketStore', () => ({
	socketStore: { connectAll: vi.fn(async () => {}), disconnectAll: vi.fn(async () => {}) },
}));

type EventListener = (event: unknown) => void;

function jwt(expSecondsFromNow: number): string {
	const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
	return `${part({ alg: 'none' })}.${part({ sub: '00000000-0000-4000-8000-000000000001', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
}

/** The LAUNCH customData the media server sends when it wakes a nearby TV (NoMercy.Setup.Cast.LaunchCustomData). */
function serverLaunch(token: string) {
	return {
		access_token: token,
		user_id: '00000000-0000-4000-8000-000000000001',
		server_id: '00000000-0000-4000-8000-000000000002',
		server_url: 'https://192-0-2-10.example.invalid:7626',
		device_id: '00000000-0000-4000-8000-000000000003',
		intent: { type: 'play_video', media_type: 'tv', media_id: '74204', season: 1, episode: 1, resume_at: 12 },
	};
}

function installFakeCast(appData: unknown): Map<string, EventListener[]> {
	const events = new Map<string, EventListener[]>();
	const context = {
		addEventListener: (type: string, fn: EventListener) => events.set(type, [...(events.get(type) ?? []), fn]),
		addCustomMessageListener: vi.fn(),
		sendCustomMessage: vi.fn(),
		getApplicationData: () => appData,
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
	return events;
}

function fireReady(events: Map<string, EventListener[]>): void {
	for (const fn of events.get('ready') ?? [])
		fn({});
}

describe('a TV the server woke opens the video from the LAUNCH customData (cast-player#61)', () => {
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

	it('signs in with the launch token and opens the episode', async () => {
		const router = { push: vi.fn(async () => {}) };
		const events = installFakeCast({ launchOptions: { customData: serverLaunch(jwt(3600)) } });
		bootCastReceiver(router as never);

		fireReady(events);

		await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
		expect(authStore.serverUrl.value).toBe('https://192-0-2-10.example.invalid:7626');
		expect(authStore.userId.value).toBe('00000000-0000-4000-8000-000000000001');
		expect(router.push).toHaveBeenCalledWith({
			path: '/tv/74204/watch',
			query: { season: '1', episode: '1', resume_at: '12' },
		});
	});

	it('reads customData sent as a JSON string on the application data itself', async () => {
		const router = { push: vi.fn(async () => {}) };
		const events = installFakeCast({ customData: JSON.stringify(serverLaunch(jwt(3600))) });
		bootCastReceiver(router as never);

		fireReady(events);

		await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
		expect(authStore.accessToken.value).not.toBeNull();
	});

	it('shows the recast screen when the launch token has expired', async () => {
		const router = { push: vi.fn(async () => {}) };
		const events = installFakeCast({ launchOptions: { customData: serverLaunch(jwt(-60)) } });
		bootCastReceiver(router as never);

		fireReady(events);

		await vi.waitFor(() => expect(authStore.receiverState.value).toBe('DEGRADED'));
		expect(router.push).not.toHaveBeenCalled();
	});

	it('waits for the sender when the launch carried no customData', () => {
		const router = { push: vi.fn(async () => {}) };
		const events = installFakeCast({ id: 'app', launchingSenderId: 'sender-1' });
		bootCastReceiver(router as never);

		fireReady(events);

		expect(router.push).not.toHaveBeenCalled();
		expect(authStore.receiverState.value).toBe('LOADING');
	});
});
