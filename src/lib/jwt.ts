/**
 * JWT decode helpers. We never validate signatures here — the server is the
 * authoritative validator. We only read claims for refresh scheduling and
 * UI display.
 */

export interface JwtPayload {
	sub?: string;
	iss?: string;
	aud?: string | string[];
	exp?: number;
	iat?: number;
	azp?: string;
	scope?: string;
	[k: string]: unknown;
}

function base64UrlDecode(input: string): string {
	// Receiver runs in browsers (cast_shell, smart-TV embedded WebViews), all of
	// which expose atob. No Node fallback needed.
	const padded = input.replace(/-/g, '+').replace(/_/g, '/');
	const padLen = (4 - (padded.length % 4)) % 4;

	return atob(padded + '='.repeat(padLen));
}

export function decodeJwt(token: string): JwtPayload | null {
	if (!token)
		return null;

	const parts = token.split('.');

	if (parts.length < 2)
		return null;

	try {
		const json = base64UrlDecode(parts[1]);

		return JSON.parse(json) as JwtPayload;
	} catch {
		return null;
	}
}

export function getJwtExpiryMs(token: string): number | null {
	const payload = decodeJwt(token);

	if (!payload?.exp)
		return null;

	return payload.exp * 1000;
}

export function isJwtExpired(token: string, skewMs = 0): boolean {
	const exp = getJwtExpiryMs(token);

	if (exp === null)
		return true;

	return Date.now() + skewMs >= exp;
}
