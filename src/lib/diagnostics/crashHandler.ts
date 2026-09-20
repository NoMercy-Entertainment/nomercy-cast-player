import { buildDiagnosticsReport } from './payload';
import { collectDeviceFacts } from './deviceFacts';
import { castDeviceId } from './deviceId';
import { diagnosticsRing, recordDiagnostic } from './sink';
import { DiagnosticsCategory, DiagnosticsCode } from './events';
import { authStore } from '@/stores/authStore';
import { postDiagnosticsReport } from '@/lib/nomercyApi';

// One upload per session. A crash loop must not become a write loop, and the
// server's rate limit is not the place to discover that.
let uploaded = false;

function describe(reason: unknown): string {
	if (reason instanceof Error)
		return `${reason.name}: ${reason.message}\n${reason.stack ?? ''}`;
	return String(reason);
}

// The error class, never its message. A message carries a fresh id on every
// fault and would exhaust the ring's 256-name table by itself.
function faultName(reason: unknown): string {
	if (reason instanceof Error)
		return reason.name;

	return 'unhandled';
}

async function upload(reason: unknown): Promise<void> {
	if (uploaded)
		return;
	uploaded = true;

	const token = authStore.accessToken.value;
	if (!token)
		return;

	const payload = buildDiagnosticsReport({
		deviceId: castDeviceId(),
		kind: 'crash',
		facts: collectDeviceFacts(),
		entries: diagnosticsRing.snapshot(),
		recorded: diagnosticsRing.recorded(),
	});
	payload.body = `${payload.body}\n\ncrash\n${describe(reason)}`;

	try {
		await postDiagnosticsReport(token, payload);
	}
	catch (err) {
		console.warn('[diagnostics] crash upload failed', err);
	}
}

/**
 * Records and reports an uncaught fault. Neither handler calls
 * preventDefault(), so the error still reaches the console and any other
 * listener exactly as it did before.
 */
export function installCrashHandlers(): void {
	window.addEventListener('error', (event: ErrorEvent) => {
		const reason = event.error ?? event.message;
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.CrashReportPending, 0, 0, 0, faultName(reason));
		void upload(reason);
	});

	window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
		recordDiagnostic(
			DiagnosticsCategory.Lifecycle,
			DiagnosticsCode.CrashReportPending,
			0,
			0,
			0,
			faultName(event.reason),
		);
		void upload(event.reason);
	});
}
