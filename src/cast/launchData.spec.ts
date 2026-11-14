import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NAMESPACE_GENERAL } from './namespaces';
import { bootCastReceiver } from './receiver';
import { authStore } from '@/stores/authStore';

vi.mock('@/stores/socketStore', () => ({
	socketStore: { connectAll: vi.fn(async () => {}), disconnectAll: vi.fn(async () => {}) },
}));

type EventListener = (event: unknown) => void;
type MessageListener = (event: { senderId?: string; data: unknown }) => void;

function jwt(expSecondsFromNow: number): string {
	const part = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
	return `${part({ alg: 'none' })}.${part({ sub: '00000000-0000-4000-8000-000000000001', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })}.sig`;
}

/** The launch data the media server sends when it wakes a nearby TV (NoMercy.Setup.Cast.LaunchCustomData). */
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

interface FakeCast {
	events: Map<string, EventListener[]>;
	messages: Map<string, MessageListener[]>;
	sendCustomMessage: ReturnType<typeof vi.fn>;
}

// CAF's ApplicationData has no launch data: id, name, sessionId, launchingSenderId and the like only.
function installFakeCast(): FakeCast {
	const events = new Map<string, EventListener[]>();
	const messages = new Map<string, MessageListener[]>();
	const sendCustomMessage = vi.fn();
	const context = {
		addEventListener: (type: string, fn: EventListener) => events.set(type, [...(events.get(type) ?? []), fn]),
		addCustomMessageListener: (ns: string, fn: MessageListener) => messages.set(ns, [...(messages.get(ns) ?? []), fn]),
		sendCustomMessage,
		getApplicationData: () => ({ id: '925B4C3C', name: 'NoMercy TV', sessionId: 1, launchingSenderId: 'sender-0', namespaces: [] }),
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
	return { events, messages, sendCustomMessage };
}

function fireReady(fake: FakeCast): void {
	for (const fn of fake.events.get('ready') ?? [])
		fn({});
}

function sendFromServer(fake: FakeCast, data: unknown): void {
	for (const fn of fake.messages.get(NAMESPACE_GENERAL) ?? [])
		fn({ senderId: 'sender-0', data });
}

describe('a TV the server woke opens the video from the launch message (cast-player#61)', () => {
	beforeEach(() => {
		window.sessionStorage.removeItem('nm_cast_mock');
		authStore.clear();
		authStore.receiverState.value = 'LOADING';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'debug').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('signs in with the launch token and opens the episode', async () => {
		const router = { push: vi.fn(async () => {}) };
		const fake = installFakeCast();
		bootCastReceiver(router as never);
		fireReady(fake);

		sendFromServer(fake, { launch: serverLaunch(jwt(3600)) });

		await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
		expect(authStore.serverUrl.value).toBe('https://192-0-2-10.example.invalid:7626');
		expect(authStore.userId.value).toBe('00000000-0000-4000-8000-000000000001');
		expect(router.push).toHaveBeenCalledWith({
			path: '/tv/74204/watch',
			query: { season: '1', episode: '1', resume_at: '12' },
		});
		expect(fake.sendCustomMessage).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-0', { ack: true, launch: true });
	});

	it('reads launch data sent as JSON text', async () => {
		const router = { push: vi.fn(async () => {}) };
		const fake = installFakeCast();
		bootCastReceiver(router as never);

		sendFromServer(fake, { launch: JSON.stringify(serverLaunch(jwt(3600))) });

		await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
		expect(authStore.accessToken.value).not.toBeNull();
	});

	it('shows the recast screen when the launch token has expired', async () => {
		const router = { push: vi.fn(async () => {}) };
		const fake = installFakeCast();
		bootCastReceiver(router as never);

		sendFromServer(fake, { launch: serverLaunch(jwt(-60)) });

		await vi.waitFor(() => expect(authStore.receiverState.value).toBe('DEGRADED'));
		expect(router.push).not.toHaveBeenCalled();
	});

	it('waits for a sender when ready fires and no launch message comes', () => {
		const router = { push: vi.fn(async () => {}) };
		const fake = installFakeCast();
		bootCastReceiver(router as never);

		fireReady(fake);

		expect(router.push).not.toHaveBeenCalled();
		expect(authStore.receiverState.value).toBe('LOADING');
	});

	it('ignores a launch message that misses the token, server or intent', () => {
		const router = { push: vi.fn(async () => {}) };
		const fake = installFakeCast();
		bootCastReceiver(router as never);

		sendFromServer(fake, { launch: { ...serverLaunch(jwt(3600)), server_url: undefined } });

		expect(router.push).not.toHaveBeenCalled();
		expect(authStore.receiverState.value).toBe('LOADING');
	});
});
