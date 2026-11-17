import type { Router } from 'vue-router';
import { ref } from 'vue';
import i18next from '@/i18n/i18next';
import { ALL_CUSTOM_NAMESPACES } from './namespaces';
import type { JsonValue, NavigatePayload, ReceiverContextLike } from './messageBus';
import type { ResolvedServer } from '@/lib/resolveServer';
import {
	attachMessageBus,
	onRemoteStop,
	onSenderNavigate,
	onSenderToken,
	onServerLaunch,
	requestTokenRenewal,
	resolveServerFromAppConfig,
} from './messageBus';
import { leaveToPreviousOrHome } from '@/router/leave';
import { authStore } from '@/stores/authStore';
import { dispatchInitialIntent } from '@/stores/navStore';
import { socketStore } from '@/stores/socketStore';
import type { LaunchCustomData } from '@/types/cast';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

/** Senders attached to this receiver; 0 on a TV that fell back here with no phone. */
export const connectedSenders = ref(0);

interface CastOptions {
	disableIdleTimeout?: boolean;
	skipPlayersLoad?: boolean;
	customNamespaces?: Record<string, string>;
}

interface CastContext extends ReceiverContextLike {
	addEventListener: (type: string, listener: () => void) => void;
	getSenders: () => readonly object[];
	start: (options: CastOptions) => void;
	stop: () => void;
}

interface CastGlobal {
	framework?: {
		CastReceiverContext: { getInstance: () => CastContext };
		CastReceiverOptions: new () => CastOptions;
	};
}

interface MockAuth {
	token: string;
	route: string;
	serverUrl?: string;
}

function isCastGlobal(value: unknown): value is CastGlobal {
	return typeof value === 'object' && value !== null;
}

function isMockAuth(value: unknown): value is MockAuth {
	return typeof value === 'object' && value !== null &&
		'token' in value && typeof value.token === 'string' &&
		'route' in value && typeof value.route === 'string';
}

function readCastGlobal(): CastGlobal | null {
	const candidate = Reflect.get(globalThis, 'cast');

	return isCastGlobal(candidate)
		? candidate
		: null;
}

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
	const castGlobal = readCastGlobal();

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
			const mock = JSON.parse(raw);

			if (!isMockAuth(mock))
				throw new Error('nm_cast_mock is not {token, route}');

			document.body.dataset.mockParsed = 'yes';

			runBoot({
				token: mock.token,
				resolve: async (onStep) => {
					const server = mock.serverUrl
						? {
								serverId: 'mock',
								serverUrl: mock.serverUrl,
								defaultSubtitleLanguage: null,
								defaultAudioLanguage: null,
							}
						: await resolveServerFromAppConfig(mock.token, {}, onStep);

					document.body.dataset.mockHasServer = String(Boolean(server));

					return server;
				},
				open: async () => {
					await router.push(mock.route);
					document.body.dataset.mockDispatched = 'yes';
				},
			});

			return;
		}
	} catch (err) {
		document.body.dataset.mockError = err instanceof Error
			? err.message
			: String(err);

		console.error('[cast] mock auth hydration failed', err);
	}

	if (!castGlobal?.framework) {
		console.warn('[cast] CAF SDK not loaded — running in non-cast preview mode');

		return;
	}

	const context = castGlobal.framework.CastReceiverContext.getInstance();

	const options = new castGlobal.framework.CastReceiverOptions();

	options.disableIdleTimeout = true;
	options.skipPlayersLoad = true;

	options.customNamespaces = Object.fromEntries(
		ALL_CUSTOM_NAMESPACES.map((ns) => [ns, 'JSON']),
	);

	attachMessageBus(context);

	// The one real handshake: NAMESPACE_GENERAL {route, token}, already
	// ack'd by attachMessageBus itself. A route/token arriving before this
	// listener registers is not possible here the way it was on the KMP
	// receiver's wasm module - Vue mounts and this file runs synchronously,
	// no multi-second binary load to race against.
	onSenderNavigate((payload, ack) => {
		if (!payload.token) {
			console.warn('[cast] navigate message carried no token');

			return;
		}

		if (!isKnownRoute(router, payload.route)) {
			console.warn('[cast] navigate route is not one the receiver has', payload.route);

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

		runNavigateBoot(payload, router, ack);
	});

	// The phone's stop casting returns the TV to where it was (WatchScreen.kt remoteStopCount).
	onRemoteStop(() => {
		if (/^\/(?:movie|tv)\/[^/]+\/watch$|^\/watch\//.test(router.currentRoute.value.path)) {
			leaveToPreviousOrHome(router);
		}
	});

	authStore.setRenewalRequester(requestTokenRenewal);

	onSenderToken((token) => {
		if (!authStore.acceptRenewedToken(token)) {
			console.warn('[cast] renewed token refused');
		}
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
	});

	onServerLaunch((data) => {
		const launch = readLaunchCustomData(data);

		if (launch) {
			startFromLaunch(launch, router);
		}
	});

	context.addEventListener('shutdown', () => {
		if (!platformReady) return;

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
 * Shuts the cast application down. The TV's cast_shell unloads this page in
 * response — the only way off a receiver that's stuck with nowhere to go
 * (e.g. the native app launch was refused and this is the fallback page).
 * Falls back to closing the window for the non-cast dev preview, where
 * there's no CastReceiverContext to stop.
 */
export function closeCastSession(): void {
	const context = readCastGlobal()?.framework?.CastReceiverContext.getInstance();

	if (context) {
		context.stop();

		return;
	}

	window.close();
}

// A server waking a TV with no phone sends NoMercy.Setup.Cast.LaunchCustomData, maybe as JSON text.
export function readLaunchCustomData(data: JsonValue | undefined): LaunchCustomData | null {
	if (typeof data !== 'string') {
		return isLaunchCustomData(data)
			? data
			: null;
	}

	try {
		const parsed = JSON.parse(data);

		return isLaunchCustomData(parsed)
			? parsed
			: null;
	} catch {
		return null;
	}
}

function isLaunchCustomData(value: unknown): value is LaunchCustomData {
	return typeof value === 'object' && value !== null &&
		'access_token' in value && Boolean(value.access_token) &&
		'server_url' in value && Boolean(value.server_url) &&
		'intent' in value && Boolean(value.intent);
}

function startFromLaunch(launch: LaunchCustomData, router: Router): void {
	recordDiagnostic(
		DiagnosticsCategory.Lifecycle,
		DiagnosticsCode.CastSessionStarted,
		0,
		0,
		0,
		`cast-launch ${launch.intent.type}`,
	);

	const server = {
		serverId: launch.server_id,
		serverUrl: launch.server_url,
		defaultSubtitleLanguage: null,
		defaultAudioLanguage: null,
	};

	runBoot({
		token: launch.access_token,
		resolve: async () => server,
		open: () => dispatchInitialIntent(launch.intent, router),
	});
}

const BootDeadlineMs = 15_000;

const BootStepReasons = {
	account: () => i18next.t('cast.boot_step_account'),
	server: () => i18next.t('cast.boot_step_server'),
	connect: () => i18next.t('cast.boot_step_connect'),
} as const;

let bootRun = 0;

interface BootPlan {
	token: string;
	resolve: (onStep: (step: 'account' | 'server') => void) => Promise<ResolvedServer | null>;
	open: () => Promise<void> | void;
	/** Runs once the route opened; a refusal before that leaves the sender without it. */
	accepted?: () => void;
}

const CatchAllPrefix = '/:pathMatch';

// An unknown route would fall into the catch-all redirect to Home and look accepted.
function isKnownRoute(router: Router, route: string): boolean {
	if (!route.startsWith('/')) return false;

	const { matched } = router.resolve(route);

	return matched.length > 0 && !matched.some((record) => record.path.startsWith(CatchAllPrefix));
}

function runNavigateBoot(payload: NavigatePayload, router: Router, ack: () => void): void {
	runBoot({
		token: payload.token!,
		resolve: (onStep) => resolveServerFromAppConfig(payload.token!, payload, onStep),
		open: async () => {
			await router.push(payload.route);
		},
		accepted: ack,
	});
}

/** One boot attempt: it ends in READY, the recast screen, or the boot error screen within the deadline. */
function runBoot(plan: BootPlan): void {
	authStore.setBootRetry(() => runBoot(plan));
	const run = ++bootRun;
	const current = (): boolean => run === bootRun;
	let step: keyof typeof BootStepReasons = 'account';

	authStore.bootError.value = null;
	authStore.receiverState.value = 'LOADING';

	const timer = setTimeout(() => {
		if (!current()) return;

		bootRun++;

		console.warn('[cast] boot passed its deadline at step', step);
		authStore.bootError.value = BootStepReasons[step]();
	}, BootDeadlineMs);

	void (async () => {
		let server: Awaited<ReturnType<typeof resolveServerFromAppConfig>>;
		let threw = false;

		try {
			server = await plan.resolve((next) => {
				if (current()) {
					step = next;
				}
			});
		} catch (err) {
			console.warn('[cast] app_config request failed', err);
			server = null;
			threw = true;
		}

		if (!current()) return;

		if (!server) {
			clearTimeout(timer);
			recordDiagnostic(DiagnosticsCategory.Network, DiagnosticsCode.RequestFailed, 0, 0, 0, 'app_config');
			console.warn('[cast] app_config resolution failed');

			if (threw) {
				authStore.receiverState.value = 'DEGRADED';
			} else {
				authStore.bootError.value = BootStepReasons.server();
			}

			return;
		}

		if (!authStore.consumeRealHandshake(plan.token, server)) {
			clearTimeout(timer);
			recordDiagnostic(DiagnosticsCategory.Network, DiagnosticsCode.RequestFailed, 0, 0, 0, 'cast-handshake token');
			console.warn('[cast] token expired or malformed at handshake time');
			authStore.receiverState.value = 'DEGRADED';

			return;
		}

		// The hubs retry on their own; playback runs over HTTP and never waits on them.
		clearTimeout(timer);
		authStore.receiverState.value = 'CONNECTING';

		void socketStore.connectAll().catch((err) => console.warn('[cast] hubs did not connect', err));

		try {
			await plan.open();
		} catch (err) {
			console.warn('[cast] route did not open', err);

			return;
		}

		if (!current()) return;

		authStore.receiverState.value = 'READY';
		plan.accepted?.();
	})();
}
