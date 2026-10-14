import { computed, ref } from 'vue';
import type { ReceiverState } from '@/types/cast';
import { decodeJwt, getJwtExpiryMs, isJwtExpired } from '@/lib/jwt';
import { refreshCastSession } from '@/lib/keycloak/refresh';
import type { ResolvedServer } from '@/lib/resolveServer';

/**
 * Volatile in-memory auth store per spec §3.2 + §8.6.
 *
 * - Tokens live in `ref()` only — no localStorage / IndexedDB / cookies.
 * - Refresh loop scheduled to fire 30s before access_token expiry.
 * - On refresh failure: receiverState transitions to DEGRADED (only auth
 *   failure triggers this; SignalR connection failure does NOT).
 * - Process death = credentials gone. Next launch from any sender brings
 *   fresh tokens.
 */

const accessToken = ref<string | null>(null);
const refreshToken = ref<string | null>(null);
const userId = ref<string | null>(null);
const serverId = ref<string | null>(null);
const serverUrl = ref<string | null>(null);
const locale = ref<string>('en-US');
const defaultSubtitleLanguage = ref<string | null>(null);
const defaultAudioLanguage = ref<string | null>(null);
const receiverState = ref<ReceiverState>('LOADING');

let refreshTimer: number | null = null;

// refreshToken is null on the real path (the phone's own live access token
// has no accompanying refresh grant this receiver can call - see
// CastSessionAuth.kt's doc comment on the KMP receiver for why), so
// readiness never requires it.
const ready = computed(
	() => accessToken.value !== null,
);

const expiresAtMs = computed(() => {
	if (!accessToken.value)
		return null;
	return getJwtExpiryMs(accessToken.value);
});

const userClaims = computed(() => {
	if (!accessToken.value)
		return null;
	return decodeJwt(accessToken.value);
});

function scheduleRefresh(): void {
	if (refreshTimer !== null) {
		window.clearTimeout(refreshTimer);
		refreshTimer = null;
	}
	const exp = expiresAtMs.value;
	if (exp === null)
		return;

	// Fire 30s before expiry. Floor at 5s to avoid tight loops if a token
	// arrives already near-expired.
	const msUntilRefresh = Math.max(exp - Date.now() - 30_000, 5_000);
	refreshTimer = window.setTimeout(() => void runRefresh(), msUntilRefresh);
}

async function runRefresh(): Promise<void> {
	if (!refreshToken.value) {
		receiverState.value = 'DEGRADED';
		return;
	}
	try {
		const result = await refreshCastSession(refreshToken.value);
		accessToken.value = result.access_token;
		refreshToken.value = result.refresh_token;
		scheduleRefresh();
	}
	catch (err) {
		console.error('[auth] refresh failed', err);
		receiverState.value = 'DEGRADED';
	}
}

/**
 * The real handshake path: a bare Keycloak access token (no refresh grant)
 * from the phone sender's NavigatePayload, plus the server this account was
 * resolved to via app_config. sub/locale come off the token's own claims —
 * the sender never sends them separately.
 *
 * Returns false (and leaves the store untouched) for an expired/malformed
 * token so the caller can fall back to device-auth instead of authing with
 * a token that will 401 on the very first request.
 */
function consumeRealHandshake(token: string, server: ResolvedServer): boolean {
	if (isJwtExpired(token))
		return false;
	const claims = decodeJwt(token);
	accessToken.value = token;
	refreshToken.value = null;
	userId.value = (claims?.sub as string | undefined) ?? null;
	serverId.value = server.serverId;
	serverUrl.value = server.serverUrl;
	locale.value = (claims?.locale as string | undefined) ?? 'en-US';
	defaultSubtitleLanguage.value = server.defaultSubtitleLanguage;
	defaultAudioLanguage.value = server.defaultAudioLanguage;
	receiverState.value = 'AUTHED';
	// No refresh grant on this path - scheduleRefresh() no-ops without a
	// refreshToken, so a token nearing expiry surfaces as a 401 (DEGRADED),
	// same as CastApiTokenProvider.refresh() on the KMP receiver.
	return true;
}

function clear(): void {
	if (refreshTimer !== null) {
		window.clearTimeout(refreshTimer);
		refreshTimer = null;
	}
	accessToken.value = null;
	refreshToken.value = null;
	userId.value = null;
	serverId.value = null;
	serverUrl.value = null;
	receiverState.value = 'TEARDOWN';
}

export const authStore = {
	accessToken,
	refreshToken,
	userId,
	serverId,
	serverUrl,
	locale,
	defaultSubtitleLanguage,
	defaultAudioLanguage,
	receiverState,
	ready,
	expiresAtMs,
	userClaims,
	consumeRealHandshake,
	clear,
	scheduleRefresh,
	forceRefresh: runRefresh,
};
