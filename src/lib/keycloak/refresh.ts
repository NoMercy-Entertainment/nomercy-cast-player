const CAST_RECEIVER_CLIENT_ID = 'nomercy-cast-receiver';

const DEFAULT_KEYCLOAK_URL =
	import.meta.env.VITE_DEFAULT_AUTH_BASE_URL ?? 'https://auth.nomercy.tv/realms/NoMercyTV';

export interface RefreshResult {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	refresh_expires_in: number;
	token_type: string;
}

export class KeycloakRefreshError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly body: string,
	) {
		super(message);
		this.name = 'KeycloakRefreshError';
	}
}

/**
 * Refresh the cast-session tokens against Keycloak's token endpoint.
 * Mirrors the server-side AuthManager refresh path but runs in the receiver
 * with a public client (no secret). Per spec §8.6 — only auth-refresh
 * failure triggers DEGRADED state; connection failure does not.
 */
const TRAILING_SLASH = /\/$/;

export async function refreshCastSession(
	refreshToken: string,
	keycloakBaseUrl: string = DEFAULT_KEYCLOAK_URL,
): Promise<RefreshResult> {
	const tokenEndpoint = `${keycloakBaseUrl.replace(TRAILING_SLASH, '')}/protocol/openid-connect/token`;

	const body = new URLSearchParams({
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		client_id: CAST_RECEIVER_CLIENT_ID,
	});

	const response = await fetch(tokenEndpoint, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	});

	const text = await response.text();

	if (!response.ok) {
		throw new KeycloakRefreshError(
			`Refresh failed: HTTP ${response.status}`,
			response.status,
			text,
		);
	}

	const json = JSON.parse(text) as RefreshResult;

	if (!json.access_token || !json.refresh_token) {
		throw new KeycloakRefreshError('Refresh response missing tokens', response.status, text);
	}

	return json;
}
