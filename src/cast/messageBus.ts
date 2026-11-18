import { buildDiagnosticsAnswer } from './diagnosticsAnswer';
import { answerControl, isControlRequest, isStopRequest } from './controlChannel';
import { castDeviceId } from '@/lib/diagnostics/deviceId';
import { videoSyncBridge } from '@/players/video/syncBridge';
import { NAMESPACE_GENERAL, NAMESPACE_STATUS } from './namespaces';
import { resolveServerFromAppConfig } from '@/lib/resolveServer';
import type { NamedServer } from '@/lib/resolveServer';
import type { ControlResponse } from './controlChannel';
import type { JsonValue } from '@/types/cast';

export type { JsonValue };

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

export interface NavigatePayload extends NamedServer {
	route: string;
	token?: string;
}

type NavigateHandler = (payload: NavigatePayload, ack: () => void) => void;
type TokenHandler = (token: string) => void;
type LaunchHandler = (launch: JsonValue) => void;

type OutboundMessage =
	| { control: ControlResponse } |
	{ diagnostics: ReturnType<typeof buildDiagnosticsAnswer> } |
	{
		ack: true;
		route?: string;
		launch?: true;
		visible?: boolean;
	} |
	{ renew: true } |
	Record<string, JsonValue>;

export interface ReceiverContextLike {
	addCustomMessageListener: (
		namespace: string,
		listener: (event: { senderId?: string; data: JsonValue }) => void,
	) => void;
	sendCustomMessage: (
		namespace: string,
		senderId: string | undefined,
		data: OutboundMessage,
	) => void;
}

let context: ReceiverContextLike | null = null;
let lastSenderId: string | undefined;
let navigateHandlers: NavigateHandler[] = [];
let tokenHandlers: TokenHandler[] = [];
let launchHandlers: LaunchHandler[] = [];
let stopHandlers: (() => void)[] = [];

// A media server that woke this TV sends its LaunchCustomData here: CAF hides the LAUNCH customData.
function isLaunchMessage(data: unknown): data is { launch: JsonValue } {
	return typeof data === 'object' && data !== null && 'launch' in data && data.launch !== undefined;
}

function isDiagnosticsRequest(data: unknown): data is { diagnostics: true } {
	return typeof data === 'object' && data !== null && 'diagnostics' in data && data.diagnostics === true;
}

function isNavigatePayload(data: unknown): data is NavigatePayload {
	return typeof data === 'object' && data !== null && 'route' in data && typeof data.route === 'string';
}

// A token with no route is the sender's answer to {renew: true}: it swaps
// the token and must never navigate.
function isTokenUpdate(data: unknown): data is { token: string } {
	return typeof data === 'object' && data !== null &&
		'token' in data && typeof data.token === 'string' &&
		(!('route' in data) || data.route === undefined);
}

export function attachMessageBus(ctx: ReceiverContextLike): void {
	context = ctx;

	ctx.addCustomMessageListener(NAMESPACE_GENERAL, (event) => {
		if (isControlRequest(event.data)) {
			const { senderId } = event;
			const stopped = isStopRequest(event.data.control);

			void answerControl(event.data.control, videoSyncBridge.current())
				.then((control) => {
					ctx.sendCustomMessage(NAMESPACE_GENERAL, senderId, { control });

					if (stopped) {
						for (const fn of stopHandlers) {
							fn();
						}
					}
				})
				.catch((err) => console.warn('[cast] control answer failed', err));

			return;
		}

		if (isDiagnosticsRequest(event.data)) {
			try {
				const diagnostics = buildDiagnosticsAnswer();

				ctx.sendCustomMessage(NAMESPACE_GENERAL, event.senderId, { diagnostics });
			} catch (err) {
				console.warn('[cast] diagnostics answer failed', err);
			}

			return;
		}

		lastSenderId = event.senderId;

		if (isLaunchMessage(event.data)) {
			try {
				ctx.sendCustomMessage(NAMESPACE_GENERAL, event.senderId, { ack: true, launch: true });
			} catch (err) {
				console.warn('[cast] launch ack send failed', err);
			}

			for (const fn of launchHandlers) {
				fn(event.data.launch);
			}

			return;
		}

		if (isTokenUpdate(event.data)) {
			for (const fn of tokenHandlers) {
				fn(event.data.token);
			}

			return;
		}

		if (!isNavigatePayload(event.data)) {
			console.debug('[cast] message on NAMESPACE_GENERAL did not parse as {route, token}', event.data);

			return;
		}

		const payload = event.data;

		// The ack tells the phone the TV took the route, so a handler sends it after its checks.
		const ack = (): void => {
			try {
				// visible=false: the TV keeps this page behind its launcher, so the phone relaunches it.
				const reply = {
					ack: true,
					route: payload.route,
					visible: document.visibilityState === 'visible',
					// The id this TV uses on the music hub; the phone targets it for a music hand-off.
					device_id: castDeviceId(),
				} as const;

				ctx.sendCustomMessage(NAMESPACE_GENERAL, event.senderId, reply);
			} catch (err) {
				console.warn('[cast] ack send failed', err);
			}
		};

		for (const fn of navigateHandlers) {
			fn(payload, ack);
		}
	});
}

export function onSenderNavigate(handler: NavigateHandler): () => void {
	navigateHandlers.push(handler);

	return () => {
		navigateHandlers = navigateHandlers.filter((h) => h !== handler);
	};
}

/** Runs after the phone's stop was answered. */
export function onRemoteStop(handler: () => void): () => void {
	stopHandlers.push(handler);

	return () => {
		stopHandlers = stopHandlers.filter((h) => h !== handler);
	};
}

export function onServerLaunch(handler: LaunchHandler): () => void {
	launchHandlers.push(handler);

	return () => {
		launchHandlers = launchHandlers.filter((h) => h !== handler);
	};
}

export function onSenderToken(handler: TokenHandler): () => void {
	tokenHandlers.push(handler);

	return () => {
		tokenHandlers = tokenHandlers.filter((h) => h !== handler);
	};
}

export function requestTokenRenewal(): void {
	if (!context || !lastSenderId) return;

	try {
		context.sendCustomMessage(NAMESPACE_GENERAL, lastSenderId, { renew: true });
	} catch (err) {
		console.warn('[cast] token renewal request failed', err);
	}
}

export function broadcastStatus(payload: Record<string, JsonValue>): void {
	if (!context || !lastSenderId) return;

	try {
		context.sendCustomMessage(NAMESPACE_STATUS, lastSenderId, payload);
	} catch (err) {
		console.warn('[cast] status broadcast failed', err);
	}
}

/** Re-exported for callers that resolve a server directly off a bare token (e.g. receiver.ts's boot path). */
export { resolveServerFromAppConfig };
