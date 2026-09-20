import { decodeJwt } from '@/lib/jwt';
import type {
	DiagnosticsReportRequest,
	DiagnosticsReportResponse,
} from '@/lib/diagnostics/payload';

/**
 * NoMercy SaaS API base URL helper. The cast receiver hits two
 * different APIs:
 *   - Per-server: authStore.serverUrl (the user's own media server) —
 *     used by lib/http/client for content endpoints.
 *   - Cross-server: NoMercy SaaS — used for /v1/me, server registration,
 *     and certificate issuance.
 *
 * The SaaS hostname must match the user's environment (prod vs dev) —
 * otherwise a dev token hits the prod API and returns 401, which is why
 * the avatar refused to load. Derive the base at call time from the
 * access token's `iss` claim (Keycloak issuer URL has the same
 * `auth.` / `auth-dev.` prefix as the matching SaaS API).
 * VITE_DEFAULT_API_BASE_URL still wins when set so local dev against a
 * different host is unaffected.
 */

const ENV_BASE = import.meta.env.VITE_DEFAULT_API_BASE_URL as string | undefined;
const STATIC_FALLBACK = 'https://api.nomercy.tv';
const AUTH_HOSTNAME_PREFIX = /^auth/;

function deriveFromIssuer(accessToken: string): string | null {
	const payload = decodeJwt(accessToken);
	const iss = payload?.iss;
	if (typeof iss !== 'string' || iss.length === 0)
		return null;
	try {
		const u = new URL(iss);
		return `${u.protocol}//${u.hostname.replace(AUTH_HOSTNAME_PREFIX, 'api')}`;
	}
	catch {
		return null;
	}
}

export function nomercyApiBase(accessToken: string | null): string {
	if (ENV_BASE)
		return ENV_BASE;
	if (accessToken) {
		const fromIss = deriveFromIssuer(accessToken);
		if (fromIss)
			return fromIss;
	}
	return STATIC_FALLBACK;
}

export interface SaasUser {
	id: string;
	name: string;
	email: string;
	currentServer: string | null;
	locale: string;
	avatarUrl: string;
	admin: boolean;
	moderator: boolean;
	messages?: unknown[];
	notifications?: unknown[];
	features?: Record<string, boolean>;
}

interface SaasResponse<T> {
	status: string;
	data: T;
}

export async function fetchSaasUser(accessToken: string): Promise<SaasUser | null> {
	if (!accessToken)
		return null;
	const base = nomercyApiBase(accessToken);
	const res = await fetch(`${base}/v1/me`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json',
		},
	});
	if (!res.ok) {
		console.warn('[saas/me] non-OK response', res.status, base);
		return null;
	}
	const body = (await res.json()) as SaasResponse<SaasUser> | SaasUser;
	if (body && typeof body === 'object' && 'status' in body) {
		const env = body as SaasResponse<SaasUser>;
		if (env.status !== 'ok')
			return null;
		return env.data;
	}
	return body as SaasUser;
}

export async function postDiagnosticsReport(
	accessToken: string,
	payload: DiagnosticsReportRequest,
): Promise<DiagnosticsReportResponse> {
	const base = nomercyApiBase(accessToken);
	const res = await fetch(`${base}/v1/diagnostics/reports`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${accessToken}`,
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok)
		throw new Error(`diagnostics upload failed with ${res.status}`);
	return (await res.json()) as DiagnosticsReportResponse;
}
