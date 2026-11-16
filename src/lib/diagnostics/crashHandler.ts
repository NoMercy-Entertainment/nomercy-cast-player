import { buildDiagnosticsReport } from './payload';
import { collectDeviceFacts } from './deviceFacts';
import { castDeviceId } from './deviceId';
import { diagnosticsRing, recordDiagnostic } from './sink';
import { DiagnosticsCategory, DiagnosticsCode } from './events';
import { diagnosticsSender } from './sender';
import { authStore } from '@/stores/authStore';
import { settingsStore } from '@/stores/settingsStore';
import { postDiagnosticsReport } from '@/lib/nomercyApi';

// One upload per session. A crash loop must not become a write loop, and the
// server's rate limit is not the place to discover that.
let uploaded = false;

// The error class, never its message. A message carries a fresh id on every
// fault and would exhaust the ring's 256-name table by itself.
function faultName(reason: unknown): string {
	if (reason instanceof Error)
		return reason.name;

	return 'unhandled';
}

const MAX_FAULTS = 3;
const MAX_MESSAGE = 200;
const STACK_LINES = 5;
const QUERY_STRING = /\?[^\s)'"]*/g;

export interface PendingCrash {
	name: string;
	message: string;
	stack: string;
}

const faults: PendingCrash[] = [];

// Stays on the device. Only a sender that asks for diagnostics reads it, so it
// is cut to what finds the line: no query strings, which carry tokens.
function keepFault(reason: unknown): void {
	if (faults.length >= MAX_FAULTS)
		return;
	const error = reason instanceof Error ? reason : null;
	faults.push({
		name: faultName(reason),
		message: (error?.message ?? String(reason)).replace(QUERY_STRING, '').slice(0, MAX_MESSAGE),
		stack: (error?.stack ?? '').split('\n').slice(0, STACK_LINES).join('\n').replace(QUERY_STRING, ''),
	});
}

/** The first faults of this session, for the diagnostics answer. */
export function pendingCrashes(): readonly PendingCrash[] {
	return faults;
}

// Off means a crash report prepared earlier is deleted, never sent later.
function dropSavedCrashReport(): void {
	if (diagnosticsSender.pending.value?.kind === 'crash')
		diagnosticsSender.discard();
}

async function upload(reason: unknown): Promise<void> {
	if (!settingsStore.crashReports.value) {
		dropSavedCrashReport();
		return;
	}

	if (uploaded)
		return;

	const token = authStore.accessToken.value;
	if (!token)
		return;
	uploaded = true;

	const payload = buildDiagnosticsReport({
		deviceId: castDeviceId(),
		kind: 'crash',
		facts: collectDeviceFacts(),
		entries: diagnosticsRing.snapshot(),
		recorded: diagnosticsRing.recorded(),
	});
	// A message or stack can hold a title, a URL or a token: the upload is automatic, so only the class leaves.
	payload.body = `${payload.body}\n\ncrash\n${faultName(reason)}`;

	try {
		await postDiagnosticsReport(token, payload);
	}
	catch (err) {
		console.warn('[diagnostics] crash upload failed', err);
	}
}

/**
 * Records an uncaught fault and reports it only while the crash-report choice
 * is on. Neither handler calls preventDefault(), so the error still reaches
 * the console and any other listener exactly as it did before.
 */
export function installCrashHandlers(): void {
	if (!settingsStore.crashReports.value)
		dropSavedCrashReport();

	window.addEventListener('error', (event: ErrorEvent) => {
		const reason = event.error ?? event.message;
		keepFault(reason);
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.CrashReportPending, 0, 0, 0, faultName(reason));
		void upload(reason);
	});

	window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
		keepFault(event.reason);
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
