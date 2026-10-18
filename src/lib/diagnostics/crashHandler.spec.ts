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
