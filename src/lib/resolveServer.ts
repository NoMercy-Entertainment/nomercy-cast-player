import { nomercyApiBase } from '@/lib/nomercyApi';

/**
 * Resolves the media server this account talks to, the same call the KMP
 * receiver makes (`fetchAppConfig`, `GET {domain}/v1/app_config`) — kept as
 * its own module so it can be called from the custom-message handshake
 * before authStore has anything else populated.
 *
 * The phone names the server it plays from (`server_id`, else `server_url`),
 * matched in the account's list. Without a match it is the first listed server that answers:
 * an account can hold a server this TV cannot reach (cast-player#64).
 */

interface AppConfigServer {
	id: string;
	serverBaseUrl: string;
	/** Absent from a control plane older than the field; the tunnel is then kept. */
	internal_server_url?: string;
	is_owner?: boolean;
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

// Picks only from the account's own list: the token goes to the server in use.
export interface NamedServer {
	server_id?: string;
	server_url?: string;
}

function origin(url: string | undefined): string | null {
	try {
		return url ? new URL(url).origin : null;
	}
	catch {
		return null;
	}
}

function findNamed(servers: AppConfigServer[], named: NamedServer): AppConfigServer | undefined {
	const byId = named.server_id ? servers.find(server => server.id === named.server_id) : undefined;
	const namedOrigin = origin(named.server_url);
	if (byId || !namedOrigin)
		return byId;
	return servers.find(server => origin(server.serverBaseUrl) === namedOrigin || origin(server.internal_server_url) === namedOrigin);
}

export type ResolveStep = 'account' | 'server';

export async function resolveServerFromAppConfig(
	accessToken: string,
	named: NamedServer = {},
	onStep: (step: ResolveStep) => void = () => {},
): Promise<ResolvedServer | null> {
	onStep('account');
	const config = await fetchAppConfig(accessToken);
	onStep('server');
	const servers = config?.servers ?? [];
	const languages = {
		defaultSubtitleLanguage: languageSetting(config?.settings, 'defaultSubtitleLanguage'),
		defaultAudioLanguage: languageSetting(config?.settings, 'defaultAudioLanguage'),
	};

	const listed = findNamed(servers, named);
	if (listed) {
		// KMP switches to the named server and never to another one (ServerSelectionLogic.kt:102-107).
		const route = await reachableRoute(listed);
		return { serverId: listed.id, serverUrl: route ?? listed.serverBaseUrl, ...languages };
	}
	// A named id the account does not have is refused, not played from another library (:104-106).
	if (named.server_id)
		return null;

	// No server named: the account's own servers first (KMP restores the saved choice, which a
	// receiver lacks). Probed together, picked in that order: a dead first server costs no wait.
	const ordered = [...servers.filter(server => server.is_owner === true), ...servers.filter(server => server.is_owner !== true)];
	const routes = await Promise.all(ordered.map(reachableRoute));
	const first = routes.findIndex(route => route !== null);
	if (first === -1)
		return null;
	return { serverId: ordered[first].id, serverUrl: routes[first]!, ...languages };
}

async function fetchAppConfig(accessToken: string): Promise<AppConfigResponse['data']> {
	const base = nomercyApiBase(accessToken);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), AppConfigTimeoutMs);
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
			return undefined;
		}
		return ((await res.json()) as AppConfigResponse).data;
	}
	finally {
		clearTimeout(timer);
	}
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

	return (await answers(internal, LocalProbeTimeoutMs)) ? internal : server.serverBaseUrl;
}

/** Longer than the LAN probe: this route can cross the tunnel. */
const RemoteProbeTimeoutMs = 4000;

/** The route this receiver reaches the server on, or null when it reaches neither. */
async function reachableRoute(server: AppConfigServer): Promise<string | null> {
	const route = await preferLocalRoute(server);
	if (route !== server.serverBaseUrl)
		return route;
	return (await answers(route.replace(TrailingSlash, ''), RemoteProbeTimeoutMs)) ? route : null;
}

async function answers(base: string, timeoutMs: number): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		// Any answer proves the route reaches the server; a 401 is as good as a 200
		// because the question is reachability, not authorization.
		await fetch(`${base}/api/v1/setup/server-info`, {
			signal: controller.signal,
			credentials: 'omit',
		});
		return true;
	}
	catch {
		return false;
	}
	finally {
		clearTimeout(timer);
	}
}
