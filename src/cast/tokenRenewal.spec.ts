import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { bootCastReceiver } from './receiver';
import { onSenderNavigate } from './messageBus';
import { NAMESPACE_GENERAL } from './namespaces';
import { authStore } from '@/stores/authStore';

type Listener = (event: { senderId?: string; data: unknown }) => void;

const server = {
	serverId: 'made-up-server',
	serverUrl: 'https://example.test',
	defaultSubtitleLanguage: null,
	defaultAudioLanguage: null,
};

function token(sub: string, exp: number): string {
	return `header.${btoa(JSON.stringify({ sub, exp }))}.signature`;
}

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

describe('the receiver asks the sender for a fresh token before it expires', () => {
	const listeners = new Map<string, Listener>();
	const sendCustomMessage = vi.fn();
	const navigate = vi.fn();

	function fromSender(data: unknown): void {
		listeners.get(NAMESPACE_GENERAL)!({ senderId: 'sender-1', data });
	}

	/** A running cast whose token has 60 s left, with the renewal request already sent. */
	function castUntilRenewalIsDue(): string {
		const current = token('made-up-user', nowSeconds() + 60);
		expect(authStore.consumeRealHandshake(current, server)).toBe(true);
		fromSender({});
		vi.advanceTimersByTime(30_000);
		return current;
	}

	beforeAll(() => {
		window.sessionStorage.removeItem('nm_cast_mock');
		vi.stubGlobal('cast', {
			framework: {
				CastReceiverContext: {
					getInstance: () => ({
						addEventListener: vi.fn(),
						addCustomMessageListener: (ns: string, fn: Listener) => listeners.set(ns, fn),
						sendCustomMessage,
						getApplicationData: vi.fn(),
						start: vi.fn(),
					}),
				},
				CastReceiverOptions: class {},
				system: { MessageType: { JSON: 'JSON' } },
			},
		});
		bootCastReceiver({ push: vi.fn() } as never);
		onSenderNavigate(navigate);
	});

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'debug').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}));
		sendCustomMessage.mockClear();
		navigate.mockClear();
	});

	afterEach(() => {
		authStore.clear();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('sends {"renew":true} to the last sender when renewal is required', () => {
		castUntilRenewalIsDue();

		expect(authStore.renewalRequired.value).toBe(true);
		expect(sendCustomMessage).toHaveBeenCalledTimes(1);
		expect(sendCustomMessage).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-1', { renew: true });
	});

	it('replaces the token from a token-only reply without navigating', () => {
		castUntilRenewalIsDue();
		const fresh = token('made-up-user', nowSeconds() + 600);

		fromSender({ token: fresh });

		expect(authStore.accessToken.value).toBe(fresh);
		expect(authStore.renewalRequired.value).toBe(false);
		expect(navigate).not.toHaveBeenCalled();
		// Only the renewal request went out: a token update gets no ack.
		expect(sendCustomMessage).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(10_000);
		expect(authStore.castAgainRequired.value).toBe(false);

		// The next renewal is scheduled from the new expiry.
		vi.advanceTimersByTime(560_000);
		expect(sendCustomMessage).toHaveBeenCalledTimes(2);
		expect(sendCustomMessage).toHaveBeenLastCalledWith(NAMESPACE_GENERAL, 'sender-1', { renew: true });
	});

	it('refuses a reply whose token belongs to another user', () => {
		const current = castUntilRenewalIsDue();

		fromSender({ token: token('another-made-up-user', nowSeconds() + 600) });

		expect(authStore.accessToken.value).toBe(current);
		expect(authStore.renewalRequired.value).toBe(true);
		expect(navigate).not.toHaveBeenCalled();
	});

	it('refuses a reply whose token is already expired', () => {
		const current = castUntilRenewalIsDue();

		fromSender({ token: token('made-up-user', nowSeconds() - 1) });

		expect(authStore.accessToken.value).toBe(current);
		expect(authStore.renewalRequired.value).toBe(true);
	});

	it('refuses a reply that is not a JWT', () => {
		const current = castUntilRenewalIsDue();

		fromSender({ token: 'not-a-token' });

		expect(authStore.accessToken.value).toBe(current);
		expect(authStore.renewalRequired.value).toBe(true);
	});

	it('keeps asking every 10 seconds and asks for a cast again only when the token expires', () => {
		castUntilRenewalIsDue();
		fromSender({ token: token('another-made-up-user', nowSeconds() + 600) });

		vi.advanceTimersByTime(10_000);
		expect(sendCustomMessage).toHaveBeenCalledTimes(2);
		expect(authStore.castAgainRequired.value).toBe(false);

		vi.advanceTimersByTime(10_000);
		expect(sendCustomMessage).toHaveBeenCalledTimes(3);
		expect(sendCustomMessage).toHaveBeenLastCalledWith(NAMESPACE_GENERAL, 'sender-1', { renew: true });

		vi.advanceTimersByTime(9_900);
		expect(authStore.castAgainRequired.value).toBe(false);

		vi.advanceTimersByTime(100);
		expect(authStore.castAgainRequired.value).toBe(true);
	});

	it('asks for a cast again when a request fails with 401 while the token is still valid', async () => {
		expect(authStore.consumeRealHandshake(token('made-up-user', nowSeconds() + 600), server)).toBe(true);
		fromSender({});

		await authStore.forceRefresh();

		expect(authStore.castAgainRequired.value).toBe(true);
		expect(authStore.receiverState.value).not.toBe('DEGRADED');
		expect(sendCustomMessage).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-1', { renew: true });
	});

	it('sends a new request on "Try again" and keeps the cast-again state until a token arrives', () => {
		castUntilRenewalIsDue();
		vi.advanceTimersByTime(30_000);
		expect(authStore.castAgainRequired.value).toBe(true);
		sendCustomMessage.mockClear();

		authStore.requestRenewal();

		expect(sendCustomMessage).toHaveBeenCalledTimes(1);
		expect(sendCustomMessage).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-1', { renew: true });
		expect(authStore.castAgainRequired.value).toBe(true);

		fromSender({ token: token('made-up-user', nowSeconds() + 600) });
		expect(authStore.castAgainRequired.value).toBe(false);
	});

	it('still acks and navigates for a payload with a route', () => {
		const payload = { route: '/movie/1/watch?cast=true&position=0', token: token('made-up-user', nowSeconds() + 600) };

		fromSender(payload);

		expect(sendCustomMessage).toHaveBeenCalledWith(NAMESPACE_GENERAL, 'sender-1', { ack: true, route: payload.route });
		expect(navigate).toHaveBeenCalledWith(payload);
	});
});
