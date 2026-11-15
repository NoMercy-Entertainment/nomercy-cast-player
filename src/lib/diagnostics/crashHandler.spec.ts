import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

// A fresh module graph per test: the handler keeps a one-upload-per-session flag
// and the settings store reads localStorage once, at import.
async function start(optIn: boolean) {
	vi.resetModules();
	const { installCrashHandlers } = await import('./crashHandler');
	const { authStore } = await import('@/stores/authStore');
	const { settingsStore } = await import('@/stores/settingsStore');
	const { diagnosticsSender } = await import('./sender');
	const fetch = vi.fn<Fetch>(async () => new Response('{}', { status: 200 }));
	vi.stubGlobal('fetch', fetch);
	authStore.accessToken.value = 'token-for-tests';
	if (optIn)
		settingsStore.crashReports.value = true;
	return { installCrashHandlers, authStore, diagnosticsSender, fetch };
}

function crash(error: Error): void {
	window.dispatchEvent(new ErrorEvent('error', { error }));
}

async function settle(): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, 20));
}

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

it('uploads nothing while the crash-report choice is off or absent', async () => {
	const { installCrashHandlers, fetch } = await start(false);
	installCrashHandlers();

	crash(new Error('crash with the choice off'));
	const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
	Object.defineProperty(rejection, 'reason', { value: new Error('rejection with the choice off') });
	window.dispatchEvent(rejection);
	await settle();

	expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([]);
});

it('deletes a saved crash report while the choice is off, and keeps a manual one', async () => {
	const { installCrashHandlers, diagnosticsSender, fetch } = await start(false);
	diagnosticsSender.prepare('crash');
	installCrashHandlers();
	expect(diagnosticsSender.pending.value).toBeNull();

	diagnosticsSender.prepare('crash');
	crash(new Error('crash with a saved report'));
	await settle();
	expect(diagnosticsSender.pending.value).toBeNull();
	expect(await diagnosticsSender.confirmSend()).toBe(false);
	expect(fetch).not.toHaveBeenCalled();

	diagnosticsSender.prepare('manual');
	crash(new Error('crash beside a manual report'));
	await settle();
	expect(diagnosticsSender.pending.value?.kind).toBe('manual');
});

it('uploads once per session while the choice is on, only when signed in', async () => {
	const { installCrashHandlers, authStore, fetch } = await start(true);
	authStore.accessToken.value = null;
	installCrashHandlers();

	crash(new Error('before auth'));
	await settle();
	expect(fetch).not.toHaveBeenCalled();

	authStore.accessToken.value = 'token-for-tests';
	crash(new Error('after auth'));
	await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
	expect(fetch).toHaveBeenCalledWith(
		expect.stringContaining('/v1/diagnostics/reports'),
		expect.objectContaining({ method: 'POST' }),
	);

	crash(new Error('another crash'));
	await settle();
	expect(fetch).toHaveBeenCalledTimes(1);
});

it('sends the error class only, never its message or stack', async () => {
	const { installCrashHandlers, fetch } = await start(true);
	installCrashHandlers();

	crash(new TypeError('Example Title eyJplaceholder'));
	await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

	const sent = String(fetch.mock.calls[0]![1]?.body);
	expect(sent).toContain('TypeError');
	expect(sent).not.toContain('Example Title');
	expect(sent).not.toContain('eyJ');
	expect(sent).not.toContain('crashHandler.spec');
});
