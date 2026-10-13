import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bootCastReceiver, closeCastSession } from './receiver';
import { NAMESPACE_GENERAL } from './namespaces';
import { authStore } from '@/stores/authStore';

type Listener = (event: { senderId?: string; data: unknown }) => void;

/** A fake cast context that keeps the custom-message listeners so a test can play the sender. */
function installFakeCast(): Map<string, Listener> {
	const listeners = new Map<string, Listener>();
	const context = {
		addEventListener: vi.fn(),
		addCustomMessageListener: (ns: string, fn: Listener) => listeners.set(ns, fn),
		sendCustomMessage: vi.fn(),
		getApplicationData: vi.fn(),
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

function sendNavigate(listeners: Map<string, Listener>): void {
	listeners.get(NAMESPACE_GENERAL)!({ senderId: 'sender-1', data: { route: '/', token: 'a.b.c' } });
}

describe('the cast handshake never leaves the TV on the splash', () => {
	beforeEach(() => {
		window.sessionStorage.removeItem('nm_cast_mock');
		authStore.receiverState.value = 'LOADING';
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('shows the recast screen when the app_config request fails', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}));
		const listeners = installFakeCast();
		bootCastReceiver({} as never);

		sendNavigate(listeners);

		await vi.waitFor(() => expect(authStore.receiverState.value).toBe('DEGRADED'));
	});

	it('shows the recast screen when the app_config request never answers', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
		})));
		const listeners = installFakeCast();
		bootCastReceiver({} as never);

		sendNavigate(listeners);
		await vi.advanceTimersByTimeAsync(30_000);

		expect(authStore.receiverState.value).toBe('DEGRADED');
	});
});

describe('closing the receiver from the splash screen', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('shuts the cast application down instead of leaving the TV stuck on the page', () => {
		const stop = vi.fn();
		vi.stubGlobal('cast', {
			framework: {
				CastReceiverContext: { getInstance: () => ({ stop }) },
			},
		});

		closeCastSession();

		expect(stop).toHaveBeenCalled();
	});
});
