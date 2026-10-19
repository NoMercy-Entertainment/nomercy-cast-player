import type {
	HubConnection,
	IRetryPolicy,
	RetryContext,
} from '@microsoft/signalr';
import {
	HttpTransportType,
	HubConnectionBuilder,
	LogLevel,

} from '@microsoft/signalr';
import { castDeviceId } from '@/lib/diagnostics/deviceId';
import { authStore } from '@/stores/authStore';

export type HubName = 'videoHub' | 'musicHub' | 'deviceHub' | 'pluginHub';

/**
 * Forever-retry policy per spec §9.1. Receiver never gives up — server may
 * be rebooting, network flapping, sender re-launching. Stale UI is fine;
 * permanent disconnect is not. Ramp 0 → 30s over the first ~minute, then
 * steady at 30s indefinitely.
 */
const foreverRetry: IRetryPolicy = {
	nextRetryDelayInMilliseconds(ctx: RetryContext): number {
		const elapsed = ctx.elapsedMilliseconds;
		if (elapsed < 1_000)
			return 0;
		if (elapsed < 5_000)
			return 1_000;
		if (elapsed < 15_000)
			return 2_000;
		if (elapsed < 30_000)
			return 5_000;
		if (elapsed < 60_000)
			return 10_000;
		return 30_000;
	},
};

/**
 * Build a hub connection bound to the current cast session.
 *
 * accessTokenFactory reads authStore.accessToken at every request,
 * picking up rotated tokens transparently. Transport pinned to WebSockets
 * — Cast hardware handles WS fine and we skip the negotiation roundtrip
 * latency.
 */
const TRAILING_SLASH = /\/$/;
const CLIENT_NAME = 'NoMercy Cast';
const CLIENT_TYPE = 'tv';

export function buildHub(name: HubName): HubConnection {
	const baseUrl = authStore.serverUrl.value;
	if (!baseUrl) {
		throw new Error(`buildHub("${name}") called before authStore.serverUrl is populated`);
	}
	const identity = new URLSearchParams({
		client_id: castDeviceId(),
		client_name: CLIENT_NAME,
		client_type: CLIENT_TYPE,
	});
	const url = `${baseUrl.replace(TRAILING_SLASH, '')}/${name}?${identity}`;

	return new HubConnectionBuilder()
		.withUrl(url, {
			accessTokenFactory: () => authStore.accessToken.value ?? '',
			transport: HttpTransportType.WebSockets,
			skipNegotiation: true,
		})
		.withAutomaticReconnect(foreverRetry)
		.configureLogging(LogLevel.Warning)
		.build();
}
