import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from './client';
import { authStore } from '@/stores/authStore';
import { diagnosticsRing } from '@/lib/diagnostics/sink';

function jsonResponse(status: number): Response {
	return new Response('{}', { status, headers: { 'Content-Type': 'application/json' } });
}

describe('the receiver http client records every request', () => {
	beforeEach(() => {
		diagnosticsRing.clear();
		authStore.serverUrl.value = 'https://media.example.test';
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('records a request that succeeded, with its status and how long it took', async () => {
		// A request that succeeded slowly is the evidence for a stall no
		// failure line can show. See
		// specs/nomercy-app-kmp/diagnostics-capture-everything.md.
		vi.stubGlobal('fetch', vi.fn(async () => {
			await new Promise(resolve => setTimeout(resolve, 40));
			return jsonResponse(200);
		}));

		await apiFetch({ path: '/api/v1/home' });

		const completed = diagnosticsRing.snapshot().filter(entry => entry.code === 'RequestCompleted');
		expect(completed).toHaveLength(1);
		expect(completed[0].a).toBe(200);
		expect(completed[0].b).toBeGreaterThanOrEqual(30);
		expect(completed[0].label).toBe('GET /api/v1/home');
	});

	it('records a one-segment relative route as a route, not as a word', async () => {
		// Read off the running web app: four POSTs landed as a bare `POST`,
		// because a path with no leading slash reached the censor as prose.
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200)));

		await apiFetch({ path: 'Watched', method: 'POST' });

		const completed = diagnosticsRing.snapshot().filter(entry => entry.code === 'RequestCompleted');
		expect(completed[0].label).toBe('POST /Watched');
	});

	it('keeps the query key and removes the query value', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200)));

		await apiFetch({ path: '/api/v1/search?query=the+matrix' });

		const completed = diagnosticsRing.snapshot().filter(entry => entry.code === 'RequestCompleted');
		expect(completed[0].label).toBe('GET /api/v1/search?query=');
	});

	it('names the failure by the same route shape as the completion beside it', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500)));

		await expect(apiFetch({ path: 'userData/continue' })).rejects.toBeTruthy();

		const failed = diagnosticsRing.snapshot().filter(entry => entry.code === 'RequestFailed');
		expect(failed).toHaveLength(1);
		expect(failed[0].a).toBe(500);
		expect(failed[0].label).toBe('GET /userData/continue');
	});

	it('records a status 0 for a request the network never answered', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}));

		await expect(apiFetch({ path: '/api/v1/home' })).rejects.toBeTruthy();

		const completed = diagnosticsRing.snapshot().filter(entry => entry.code === 'RequestCompleted');
		expect(completed).toHaveLength(1);
		expect(completed[0].a).toBe(0);
	});

	it('aborts a request the server never answers, instead of hanging forever', async () => {
		vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => {
				reject(new DOMException('The operation was aborted.', 'AbortError'));
			});
		})));

		await expect(apiFetch({ path: '/api/v1/home' })).rejects.toBeTruthy();
	}, 20_000);

	it('still sends and still obeys the caller abort on a TV browser without AbortSignal.any or AbortSignal.timeout', async () => {
		const { any, timeout } = AbortSignal;
		Object.assign(AbortSignal, { any: undefined, timeout: undefined });
		try {
			vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200)));
			await expect(apiFetch({ path: '/api/v1/home', signal: new AbortController().signal })).resolves.toBeTruthy();

			vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
			})));
			const caller = new AbortController();
			const pending = apiFetch({ path: '/api/v1/home', signal: caller.signal });
			caller.abort();
			await expect(pending).rejects.toBeTruthy();
		}
		finally {
			Object.assign(AbortSignal, { any, timeout });
		}
	});
});
