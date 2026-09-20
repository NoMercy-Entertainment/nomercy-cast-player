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
	return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * `METHOD /route` — the censor strips the origin and every query value. The
 * leading slash is added when a caller left it off: without it a one-segment
 * path is a bare word, and the censor drops it as prose rather than reading it
 * as the route it is.
 */
export function requestLabel(opts: FetchOptions): string {
	const route = opts.path.startsWith('/') ? opts.path : `/${opts.path}`;

	return `${(opts.method ?? 'GET').toUpperCase()} ${route}`;
}

async function singleAttempt(opts: FetchOptions): Promise<Response> {
	const headers = new Headers(opts.headers ?? {});
	headers.set('Accept', 'application/json');
	if (!opts.skipAuth) {
		const token = authStore.accessToken.value;
		if (token)
			headers.set('Authorization', `Bearer ${token}`);
	}

	// Every request, not only the failures. A request that succeeded slowly is
	// the evidence for a stall no failure line can show. Recorded per attempt,
	// so the 401 retry ladder above is visible as the three calls it really is.
	// See specs/nomercy-app-kmp/diagnostics-capture-everything.md.
	const startedAt = performance.now();

	try {
		const response = await fetch(buildUrl(opts.path), { ...opts, headers });
		recordCompleted(opts, response.status, startedAt);
		return response;
	}
	catch (error) {
		recordCompleted(opts, 0, startedAt);
		throw error;
	}
}

function recordCompleted(opts: FetchOptions, status: number, startedAt: number): void {
	recordDiagnostic(
		DiagnosticsCategory.Network,
		DiagnosticsCode.RequestCompleted,
		status,
		Math.round(performance.now() - startedAt),
		0,
		requestLabel(opts),
	);
}

export async function apiFetch<T = unknown>(opts: FetchOptions): Promise<T> {
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
		return undefined as unknown as T;
	try {
		return JSON.parse(text) as T;
	}
	catch {
		return text as unknown as T;
	}
}
