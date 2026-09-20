import type { Router } from 'vue-router';
import { ALL_CUSTOM_NAMESPACES } from './namespaces';
import { attachMessageBus, onSenderNavigate, resolveServerFromAppConfig } from './messageBus';
import { authStore } from '@/stores/authStore';
import { socketStore } from '@/stores/socketStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

/**
 * Cast receiver bootstrap. Called once from main.ts after the Vue app
 * mounts. Wires custom namespaces, attaches launch listeners, and forwards
 * the initial intent into vue-router.
 *
 * disableIdleTimeout: true keeps the session alive past Cast's default 5min
 * idle timeout — receiver-side screensaver handling lands in Phase 10.
 *
 * Const-enum values from @types/chromecast-caf-receiver can't be accessed
 * through ambient namespaces under isolatedModules; we use the equivalent
 * string literals at runtime — both resolve to the same enum value.
 */
export function bootCastReceiver(router: Router): void {
	// Runtime guard — the CAF SDK <script> in index.html may fail to load in
	// dev preview. Without it we render the splash and skip cast wiring.
	const castGlobal = (globalThis as { cast?: unknown }).cast as
		| {
			framework?: {
				CastReceiverContext: {
					getInstance: () => unknown;
				};
				CastReceiverOptions: new () => Record<string, unknown>;
				system: { MessageType: { JSON: string } };
			};
		}
		| undefined;

	// Dev-only escape hatch — set sessionStorage["nm_cast_mock"] to
	// {token, route, serverUrl?} before navigating to the receiver and we'll
	// hydrate authStore directly so the receiver UI is reachable in plain
	// Chrome for parity QC. serverUrl lets local dev skip the app_config
	// network round-trip; omit it to exercise the real resolution path.
	// Honoured even when the CAF SDK is partially loaded (script reachable
	// but IPC down); production casts arrive via a real custom message so
	// this branch is dormant unless someone opted in.
	try {
		const raw = window.sessionStorage.getItem('nm_cast_mock');
		document.body.dataset.mockHasRaw = String(Boolean(raw));
		if (raw) {
			const mock = JSON.parse(raw) as { token: string; route: string; serverUrl?: string };
			document.body.dataset.mockParsed = 'yes';
			void (async () => {
				const server = mock.serverUrl
					? { serverId: 'mock', serverUrl: mock.serverUrl }
					: await resolveServerFromAppConfig(mock.token);
				document.body.dataset.mockHasServer = String(Boolean(server));
				if (!server)
					return;
				const ok = authStore.consumeRealHandshake(mock.token, server);
				document.body.dataset.mockHydrated = String(ok);
				if (ok) {
					await bootSocketsAndDispatch(mock.route, router);
					document.body.dataset.mockDispatched = 'yes';
				}
			})();
			return;
		}
	}
	catch (err) {
		document.body.dataset.mockError = (err as Error).message;
		console.error('[cast] mock auth hydration failed', err);
	}

	if (!castGlobal?.framework) {
		console.warn('[cast] CAF SDK not loaded — running in non-cast preview mode');
		return;
	}

	const context = castGlobal.framework.CastReceiverContext.getInstance() as {
		addEventListener: (type: string, listener: (event: unknown) => void) => void;
		addCustomMessageListener: (
			namespace: string,
			listener: (event: { senderId?: string; data: unknown }) => void,
		) => void;
		sendCustomMessage: (
			namespace: string,
			senderId: string | undefined,
			data: unknown,
		) => void;
		getApplicationData: () => unknown;
		start: (options: Record<string, unknown>) => void;
	};

	const options = new castGlobal.framework.CastReceiverOptions();
	options.disableIdleTimeout = true;
	options.skipPlayersLoad = true;
	options.customNamespaces = Object.fromEntries(
		ALL_CUSTOM_NAMESPACES.map(ns => [ns, 'JSON']),
	);

	attachMessageBus(context);

	// The one real handshake: NAMESPACE_GENERAL {route, token}, already
	// ack'd by attachMessageBus itself. A route/token arriving before this
	// listener registers is not possible here the way it was on the KMP
	// receiver's wasm module - Vue mounts and this file runs synchronously,
	// no multi-second binary load to race against.
	onSenderNavigate((payload) => {
		if (!payload.token) {
			console.warn('[cast] navigate message carried no token');
			return;
		}
		// A session start is its own transition, not a foreground: the receiver
		// was already running when the sender arrived.
		recordDiagnostic(
			DiagnosticsCategory.Lifecycle,
			DiagnosticsCode.CastSessionStarted,
			0,
			0,
			0,
			`cast-session ${payload.route}`,
		);
		void (async () => {
			const server = await resolveServerFromAppConfig(payload.token!);
			if (!server) {
				recordDiagnostic(
					DiagnosticsCategory.Network,
					DiagnosticsCode.RequestFailed,
					0,
					0,
					0,
					'app_config',
				);
				console.warn('[cast] app_config resolution failed');
				authStore.receiverState.value = 'DEGRADED';
				return;
			}
			if (!authStore.consumeRealHandshake(payload.token!, server)) {
				recordDiagnostic(
					DiagnosticsCategory.Network,
					DiagnosticsCode.RequestFailed,
					0,
					0,
					0,
					'cast-handshake token',
				);
				console.warn('[cast] token expired or malformed at handshake time');
				authStore.receiverState.value = 'DEGRADED';
				return;
			}
			await bootSocketsAndDispatch(payload.route, router);
		})();
	});

	context.addEventListener('SHUTDOWN', () => {
		recordDiagnostic(
			DiagnosticsCategory.Lifecycle,
			DiagnosticsCode.CastSessionEnded,
			0,
			0,
			0,
			'cast-session shutdown',
		);
		void socketStore.disconnectAll();
		authStore.clear();
	});

	context.start(options);
}

/**
 * Boot SignalR + navigate to the sender's requested route. Sequenced so the
 * receiver's Vue components can read live socket state (and fire RPC
 * commands) by the time their first `onMounted` lifecycle runs.
 *
 * SignalR connection failure does NOT block navigation - the UI shows the
 * browse view with the connection-state badge, and forever-retry recovers
 * in the background.
 *
 * `route` is the sender's own full path+query string (e.g.
 * "/movie/533535/watch?cast=true&position=0") - router.push parses it
 * directly, no CastIntent reconstruction needed.
 */
async function bootSocketsAndDispatch(
	route: string,
	router: Router,
): Promise<void> {
	authStore.receiverState.value = 'CONNECTING';
	void socketStore.connectAll().then(() => {
		authStore.receiverState.value = 'READY';
	});
	await router.push(route);
}
