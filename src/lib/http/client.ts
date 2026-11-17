import { authStore } from '@/stores/authStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

/**
 * Shared fetch wrapper for receiver HTTP calls.
 *
 * - Auth header injected from authStore on every request (token rotation
 *   transparent — refresh loop swaps the value behind the scenes).
 * - Server URL is the cast session's server_url (per LAUNCH customData).
 * - 401 retry policy per spec §9.7: one immediate retry (token may have
 *   rotated mid-flight), then trigger forceRefresh + one more retry.
 *   Persistent 401 → DEGRADED.
 */

export class HttpError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly body: string,
	) {
		super(message);
		this.name = 'HttpError';
	}
}

export interface FetchOptions extends RequestInit {
	/** Path relative to authStore.serverUrl, e.g. "/api/v1/home". */
	path: string;
	/** Skip the auth header injection (e.g. when probing public endpoints). */
	skipAuth?: boolean;
}

const TRAILING_SLASH = /\/$/;

function buildUrl(path: string): string {
	const base = authStore.serverUrl.value?.replace(TRAILING_SLASH, '') ?? '';

	if (!base)
		throw new HttpError('serverUrl not available', 0, '');

	return `${base}${path.startsWith('/')
		? path
		: `/${path}`}`;
}

/**
 * `METHOD /route` — the censor strips the origin and every query value. The
 * leading slash is added when a caller left it off: without it a one-segment
 * path is a bare word, and the censor drops it as prose rather than reading it
 * as the route it is.
 */
export function requestLabel(opts: FetchOptions): string {
	const route = opts.path.startsWith('/')
		? opts.path
		: `/${opts.path}`;

	return `${(opts.method ?? 'GET').toUpperCase()} ${route}`;
}

async function singleAttempt(opts: FetchOptions): Promise<Response> {
	const headers = new Headers(opts.headers ?? {});

	headers.set('Accept', 'application/json');

	if (!opts.skipAuth) {
		const token = authStore.accessToken.value;

		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
		}
	}

	// Every request, not only the failures. A request that succeeded slowly is
	// the evidence for a stall no failure line can show. Recorded per attempt,
	// so the 401 retry ladder above is visible as the three calls it really is.
	// See specs/nomercy-app-kmp/diagnostics-capture-everything.md.
	const startedAt = performance.now();

	const { signal, clear, timedOut } = withTimeout(opts.signal, 15_000);

	try {
		const response = await fetch(buildUrl(opts.path), {
			...opts,
			headers,
			signal,
		});

		recordCompleted(opts, response.status, startedAt);

		return response;
	} catch (error) {
		clear();
		recordCompleted(opts, 0, startedAt);

		// Our own timeout reads as "The user aborted a request." in the browser; say what it was.
		if (timedOut())
			throw new Error('Request timed out', { cause: error });

		throw error;
	}
}

// AbortSignal.any and AbortSignal.timeout are missing on older Cast firmware
// browsers, so the timeout is a plain controller that also follows the caller.
// On success the timer keeps running: it also ends a body that stalls mid-read.
function withTimeout(callerSignal: AbortSignal | null | undefined, ms: number) {
	const controller = new AbortController();
	let fired = false;
	const abort = (): void => controller.abort();
	const timer = setTimeout(() => {
		fired = true;
		abort();
	}, ms);

	if (callerSignal?.aborted) {
		abort();
	}

	callerSignal?.addEventListener('abort', abort, { once: true });

	return {
		signal: controller.signal,
		clear: () => {
			clearTimeout(timer);
			callerSignal?.removeEventListener('abort', abort);
		},
		timedOut: () => fired,
	} as const satisfies {
		signal: AbortSignal;
		clear: () => void;
		timedOut: () => boolean;
	};
}

function recordCompleted(opts: FetchOptions, status: number, startedAt: number): void {
	const elapsedMs = Math.round(performance.now() - startedAt);

	recordDiagnostic(
		DiagnosticsCategory.Network,
		DiagnosticsCode.RequestCompleted,
		status,
		elapsedMs,
		0,
		requestLabel(opts),
	);
}

export async function apiFetch<T>(opts: FetchOptions): Promise<T> {
	let response = await singleAttempt(opts);

	if (response.status === 401 && !opts.skipAuth) {
		// First 401: token may have rotated mid-flight, immediate retry with
		// freshest accessToken value reads from authStore.
		response = await singleAttempt(opts);

		if (response.status === 401) {
			// Second 401: trigger refresh, then one more retry. After this we
			// give up — refresh loop will mark DEGRADED if the refresh itself
			// fails.
			await authStore.forceRefresh();
			response = await singleAttempt(opts);
		}
	}

	const text = await response.text();

	if (!response.ok) {
		recordDiagnostic(
			DiagnosticsCategory.Network,
			DiagnosticsCode.RequestFailed,
			response.status,
			0,
			0,
			requestLabel(opts),
		);

		throw new HttpError(`HTTP ${response.status} on ${opts.path}`, response.status, text);
	}

	if (!text)
		return undefined as T;

	try {
		return JSON.parse(text);
	} catch {
		return text as T;
	}
}
