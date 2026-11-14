import type { Router } from 'vue-router';
import { ref } from 'vue';
import { ALL_CUSTOM_NAMESPACES } from './namespaces';
import { attachMessageBus, onSenderNavigate, onSenderToken, requestTokenRenewal, resolveServerFromAppConfig } from './messageBus';
import { authStore } from '@/stores/authStore';
import { dispatchInitialIntent } from '@/stores/navStore';
import { socketStore } from '@/stores/socketStore';
import type { LaunchCustomData } from '@/types/cast';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

/** Senders attached to this receiver; 0 on a TV that fell back here with no phone. */
export const connectedSenders = ref(0);

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
				let server: Awaited<ReturnType<typeof resolveServerFromAppConfig>>;
				try {
					server = mock.serverUrl
						? { serverId: 'mock', serverUrl: mock.serverUrl, defaultSubtitleLanguage: null, defaultAudioLanguage: null }
						: await resolveServerFromAppConfig(mock.token);
				}
				catch (err) {
					console.warn('[cast] mock app_config request failed', err);
					authStore.receiverState.value = 'DEGRADED';
					return;
				}
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
		getSenders: () => unknown[];
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
			let server: Awaited<ReturnType<typeof resolveServerFromAppConfig>>;
			try {
				server = await resolveServerFromAppConfig(payload.token!);
			}
			catch (err) {
				console.warn('[cast] app_config request failed', err);
				server = null;
			}
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

	authStore.setRenewalRequester(requestTokenRenewal);
	onSenderToken((token) => {
		if (!authStore.acceptRenewedToken(token))
			console.warn('[cast] renewed token refused');
	});

	// CAF fires the enum values (cast.framework.system.EventType), never the enum names.
	const countSenders = (): void => {
		connectedSenders.value = context.getSenders().length;
	};
	context.addEventListener('senderconnected', countSenders);
	context.addEventListener('senderdisconnected', countSenders);

	// 'ready' fires only when the Cast platform answers. A plain browser never gets it and
	// fires 'shutdown' on every failed reconnect, which must not end the screen there.
	let platformReady = false;
	context.addEventListener('ready', () => {
		platformReady = true;
		const launch = readLaunchCustomData(context.getApplicationData());
		if (launch)
			void startFromLaunch(launch, router);
	});

	context.addEventListener('shutdown', () => {
		if (!platformReady)
			return;
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
/**
 * Shuts the cast application down. The TV's cast_shell unloads this page in
 * response — the only way off a receiver that's stuck with nowhere to go
 * (e.g. the native app launch was refused and this is the fallback page).
 * Falls back to closing the window for the non-cast dev preview, where
 * there's no CastReceiverContext to stop.
 */
export function closeCastSession(): void {
	const castGlobal = (globalThis as { cast?: unknown }).cast as
		| { framework?: { CastReceiverContext: { getInstance: () => { stop: () => void } } } }
		| undefined;
	const context = castGlobal?.framework?.CastReceiverContext.getInstance();
	if (context) {
		context.stop();
		return;
	}
	window.close();
}

// A server waking a TV with no phone sends NoMercy.Setup.Cast.LaunchCustomData: under
// launchOptions.customData for a server LAUNCH, on customData for a sender SDK, maybe as JSON text.
export function readLaunchCustomData(appData: unknown): LaunchCustomData | null {
	const data = appData as { customData?: unknown; launchOptions?: { customData?: unknown } } | null;
	let raw = data?.launchOptions?.customData ?? data?.customData;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		}
		catch {
			return null;
		}
	}
	const launch = raw as Partial<LaunchCustomData> | null | undefined;
	if (!launch?.access_token || !launch.server_url || !launch.intent)
		return null;
	return launch as LaunchCustomData;
}

async function startFromLaunch(launch: LaunchCustomData, router: Router): Promise<void> {
	recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.CastSessionStarted, 0, 0, 0, `cast-launch ${launch.intent.type}`);
	const server = {
		serverId: launch.server_id,
		serverUrl: launch.server_url,
		defaultSubtitleLanguage: null,
		defaultAudioLanguage: null,
	};
	if (!authStore.consumeRealHandshake(launch.access_token, server)) {
		console.warn('[cast] launch token expired or malformed');
		authStore.receiverState.value = 'DEGRADED';
		return;
	}
	authStore.receiverState.value = 'CONNECTING';
	void socketStore.connectAll().then(() => {
		authStore.receiverState.value = 'READY';
	});
	dispatchInitialIntent(launch.intent, router);
}

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
