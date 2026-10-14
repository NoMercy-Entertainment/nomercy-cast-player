import { nomercyApiBase } from '@/lib/nomercyApi';

/**
 * Resolves the media server this account talks to, the same call the KMP
 * receiver makes (`fetchAppConfig`, `GET {domain}/v1/app_config`) — kept as
 * its own module so it can be called from the custom-message handshake
 * before authStore has anything else populated.
 *
 * No server-selection UI exists on this receiver yet (matches the KMP
 * receiver's own documented gap) — always the account's first server.
 */

interface AppConfigServer {
	id: string;
	serverBaseUrl: string;
	/** Absent from a control plane older than the field; the tunnel is then kept. */
	internal_server_url?: string;
}

interface AppConfigResponse {
	data?: {
		servers?: AppConfigServer[];
		settings?: Record<string, unknown>;
	};
}

export interface ResolvedServer {
	serverId: string;
	serverUrl: string;
	/**
	 * The account's last picked languages. The phone and the web app write them
	 * on every pick (settings sync); without them the TV starts every cast with
	 * no subtitle, while the phone shows the one it remembered.
	 */
	defaultSubtitleLanguage: string | null;
	defaultAudioLanguage: string | null;
}

// app_config sends each synced setting as { value, updatedAt }.
function languageSetting(settings: Record<string, unknown> | undefined, key: string): string | null {
	const entry = settings?.[key];
	const value = typeof entry === 'object' && entry !== null ? (entry as { value?: unknown }).value : entry;
	return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * A request that never answers must end in a failure the caller can show, not
 * leave the TV on the splash. Long enough for a slow network, short enough that
 * the user can recast.
 */
const AppConfigTimeoutMs = 10_000;

export async function resolveServerFromAppConfig(accessToken: string): Promise<ResolvedServer | null> {
	const base = nomercyApiBase(accessToken);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), AppConfigTimeoutMs);
	let body: AppConfigResponse;
	try {
		const res = await fetch(`${base}/v1/app_config`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json',
			},
			signal: controller.signal,
		});
		if (!res.ok) {
			console.warn('[app_config] non-OK response', res.status, base);
			return null;
		}
		body = (await res.json()) as AppConfigResponse;
	}
	finally {
		clearTimeout(timer);
	}
	const server = body.data?.servers?.[0];
	if (!server)
		return null;
	return {
		serverId: server.id,
		serverUrl: await preferLocalRoute(server),
		defaultSubtitleLanguage: languageSetting(body.data?.settings, 'defaultSubtitleLanguage'),
		defaultAudioLanguage: languageSetting(body.data?.settings, 'defaultAudioLanguage'),
	};
}

/**
 * Short on purpose: a cast device sits on the same LAN as the server or it does
 * not, and this runs inside the sender's 8s ACK window.
 */
const LocalProbeTimeoutMs = 1500;

const TrailingSlash = /\/$/;

/**
 * The server's LAN address when this receiver can reach it, else the tunnel.
 *
 * nomercy-tv hands every caller the tunnel URL once a server has one, so a
 * Chromecast in the same room as the server pulled its video out to the
 * Cloudflare edge and back. Measured on a live tunnel, all of that traffic lands
 * on a single QUIC edge connection — 214 MB on one conn_index against ~21 KB on
 * each of the other three — and once it saturates, everything multiplexed onto it
 * stalls until cloudflared times out its origin dial and calls a healthy server
 * unreachable.
 *
 * A cast receiver is on the viewer's own network by definition, so this is the
 * client most likely to have a LAN route and least able to afford the tunnel.
 */
async function preferLocalRoute(server: AppConfigServer): Promise<string> {
	const internal = server.internal_server_url?.replace(TrailingSlash, '');
	if (!internal || internal === server.serverBaseUrl.replace(TrailingSlash, ''))
		return server.serverBaseUrl;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), LocalProbeTimeoutMs);

	try {
		// Any answer proves the route reaches the server; a 401 is as good as a 200
		// because the question is reachability, not authorisation.
		await fetch(`${internal}/api/v1/setup/server-info`, {
			signal: controller.signal,
			credentials: 'omit',
		});
		return internal;
	}
	catch {
		return server.serverBaseUrl;
	}
	finally {
		clearTimeout(timer);
	}
}
