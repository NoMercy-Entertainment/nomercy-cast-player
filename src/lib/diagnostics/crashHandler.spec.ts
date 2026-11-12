import { afterEach, expect, it, vi } from 'vitest';
import { authStore } from '@/stores/authStore';
import { installCrashHandlers } from './crashHandler';

afterEach(() => {
	authStore.accessToken.value = null;
	vi.unstubAllGlobals();
});

it('uploads once after a crash before authentication', async () => {
	const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
	vi.stubGlobal('fetch', fetch);
	authStore.accessToken.value = null;
	installCrashHandlers();

	window.dispatchEvent(new ErrorEvent('error', { error: new Error('before auth') }));
	expect(fetch).not.toHaveBeenCalled();

	authStore.accessToken.value = 'token-for-tests';
	window.dispatchEvent(new ErrorEvent('error', { error: new Error('after auth') }));
	await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
	expect(fetch).toHaveBeenCalledWith(
		expect.stringContaining('/v1/diagnostics/reports'),
		expect.objectContaining({ method: 'POST' }),
	);

	window.dispatchEvent(new ErrorEvent('error', { error: new Error('another crash') }));
	expect(fetch).toHaveBeenCalledTimes(1);
});

it('sends the error class only, never its message or stack', async () => {
	vi.resetModules();
	const { installCrashHandlers: install } = await import('./crashHandler');
	const { authStore: store } = await import('@/stores/authStore');
	const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }));
	vi.stubGlobal('fetch', fetch);
	store.accessToken.value = 'token-for-tests';
	install();

	window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('Example Title eyJplaceholder') }));
	await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

	const sent = String(fetch.mock.calls[0][1]?.body);
	expect(sent).toContain('TypeError');
	expect(sent).not.toContain('Example Title');
	expect(sent).not.toContain('eyJ');
	expect(sent).not.toContain('crashHandler.spec');
	store.accessToken.value = null;
});
