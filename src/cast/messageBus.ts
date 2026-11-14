import { buildDiagnosticsAnswer } from './diagnosticsAnswer';
import { NAMESPACE_GENERAL, NAMESPACE_STATUS } from './namespaces';
import { resolveServerFromAppConfig } from '@/lib/resolveServer';

/**
 * Outbound + inbound custom-namespace message bus.
 *
 * The real sender (PhoneCastSenderImpl.kt / DevicePickerDialog.kt) sends a
 * plain {route, token} JSON payload on NAMESPACE_GENERAL and waits up to 8s
 * for a {"ack":true,"route":...} echo back on the same channel before it
 * gives up (ACK_TIMEOUT_MS) - this is the ONE real handshake, not the
 * launch-customData / multi-namespace design this file previously spoke,
 * which no current sender ever populates. `token` is the phone's own live
 * Keycloak access token, used as-is (no exchange call - see
 * CastSessionAuth.kt's own doc comment on the KMP receiver for why token
 * exchange is unavailable to a public client).
 */

export interface NavigatePayload {
	route: string;
	token?: string;
}

type NavigateHandler = (payload: NavigatePayload) => void;
type TokenHandler = (token: string) => void;
type LaunchHandler = (launch: unknown) => void;

interface ReceiverContextLike {
	addCustomMessageListener: (
		namespace: string,
		listener: (event: { senderId?: string; data: unknown }) => void,
	) => void;
	sendCustomMessage: (
		namespace: string,
		senderId: string | undefined,
		data: unknown,
	) => void;
}

let context: ReceiverContextLike | null = null;
let lastSenderId: string | undefined;
let navigateHandlers: NavigateHandler[] = [];
let tokenHandlers: TokenHandler[] = [];
let launchHandlers: LaunchHandler[] = [];

// A media server that woke this TV sends its LaunchCustomData here: CAF hides the LAUNCH customData.
function isLaunchMessage(data: unknown): data is { launch: unknown } {
	return typeof data === 'object' && data !== null && (data as { launch?: unknown }).launch !== undefined;
}

function isNavigatePayload(data: unknown): data is NavigatePayload {
	return typeof data === 'object' && data !== null && typeof (data as { route?: unknown }).route === 'string';
}

// A token with no route is the sender's answer to {renew: true}: it swaps
// the token and must never navigate.
function isTokenUpdate(data: unknown): data is { token: string } {
	return typeof data === 'object' && data !== null
		&& typeof (data as { token?: unknown }).token === 'string'
		&& (data as { route?: unknown }).route === undefined;
}

export function attachMessageBus(ctx: ReceiverContextLike): void {
	context = ctx;

	ctx.addCustomMessageListener(NAMESPACE_GENERAL, (event) => {
		if ((event.data as { diagnostics?: unknown } | null)?.diagnostics === true) {
			try {
				ctx.sendCustomMessage(NAMESPACE_GENERAL, event.senderId, { diagnostics: buildDiagnosticsAnswer() });
			}
			catch (err) {
				console.warn('[cast] diagnostics answer failed', err);
			}
			return;
		}
		lastSenderId = event.senderId;
		if (isLaunchMessage(event.data)) {
			try {
				ctx.sendCustomMessage(NAMESPACE_GENERAL, event.senderId, { ack: true, launch: true });
			}
			catch (err) {
				console.warn('[cast] launch ack send failed', err);
			}
			for (const fn of launchHandlers) fn(event.data.launch);
			return;
		}
		if (isTokenUpdate(event.data)) {
			for (const fn of tokenHandlers) fn(event.data.token);
			return;
		}
		if (!isNavigatePayload(event.data)) {
			console.debug('[cast] message on NAMESPACE_GENERAL did not parse as {route, token}', event.data);
			return;
		}
		const payload = event.data;
		try {
			ctx.sendCustomMessage(NAMESPACE_GENERAL, event.senderId, { ack: true, route: payload.route });
		}
		catch (err) {
			console.warn('[cast] ack send failed', err);
		}
		for (const fn of navigateHandlers) fn(payload);
	});
}

export function onSenderNavigate(handler: NavigateHandler): () => void {
	navigateHandlers.push(handler);
	return () => {
		navigateHandlers = navigateHandlers.filter(h => h !== handler);
	};
}

export function onServerLaunch(handler: LaunchHandler): () => void {
	launchHandlers.push(handler);
	return () => {
		launchHandlers = launchHandlers.filter(h => h !== handler);
	};
}

export function onSenderToken(handler: TokenHandler): () => void {
	tokenHandlers.push(handler);
	return () => {
		tokenHandlers = tokenHandlers.filter(h => h !== handler);
	};
}

export function requestTokenRenewal(): void {
	if (!context || !lastSenderId)
		return;
	try {
		context.sendCustomMessage(NAMESPACE_GENERAL, lastSenderId, { renew: true });
	}
	catch (err) {
		console.warn('[cast] token renewal request failed', err);
	}
}

export function broadcastStatus(payload: Record<string, unknown>): void {
	if (!context || !lastSenderId)
		return;
	try {
		context.sendCustomMessage(NAMESPACE_STATUS, lastSenderId, payload);
	}
	catch (err) {
		console.warn('[cast] status broadcast failed', err);
	}
}

/** Re-exported for callers that resolve a server directly off a bare token (e.g. receiver.ts's boot path). */
export { resolveServerFromAppConfig };
