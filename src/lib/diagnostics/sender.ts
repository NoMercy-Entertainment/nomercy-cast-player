import { ref } from 'vue';
import type { DiagnosticsReportKind, DiagnosticsReportRequest } from './payload';
import { buildDiagnosticsReport } from './payload';
import { collectDeviceFacts } from './deviceFacts';
import { castDeviceId } from './deviceId';
import { diagnosticsRing } from './sink';
import { authStore } from '@/stores/authStore';
import { postDiagnosticsReport } from '@/lib/nomercyApi';

export type DiagnosticsSendState = 'idle' | 'sending' | 'sent' | 'failed';

const pending = ref<DiagnosticsReportRequest | null>(null);
const state = ref<DiagnosticsSendState>('idle');
const lastError = ref<string | null>(null);
const lastReportId = ref<string | null>(null);

/**
 * Renders a report and holds it. Nothing leaves the device here — the user has
 * to read this payload and confirm it, and that is the privacy contract.
 */
function prepare(kind: DiagnosticsReportKind = 'manual'): DiagnosticsReportRequest {
	const payload = buildDiagnosticsReport({
		deviceId: castDeviceId(),
		kind,
		facts: collectDeviceFacts(),
		entries: diagnosticsRing.snapshot(),
		recorded: diagnosticsRing.recorded(),
	});
	pending.value = payload;
	state.value = 'idle';
	lastError.value = null;
	lastReportId.value = null;
	return payload;
}

function discard(): void {
	pending.value = null;
	state.value = 'idle';
	lastError.value = null;
}

async function confirmSend(): Promise<boolean> {
	const payload = pending.value;
	if (!payload)
		return false;

	const token = authStore.accessToken.value;
	if (!token) {
		state.value = 'failed';
		lastError.value = 'Not signed in';
		return false;
	}

	state.value = 'sending';
	try {
		const response = await postDiagnosticsReport(token, payload);
		lastReportId.value = response.id;
		state.value = 'sent';
		pending.value = null;
		return true;
	}
	catch (err) {
		state.value = 'failed';
		lastError.value = err instanceof Error ? err.message : String(err);
		return false;
	}
}

export const diagnosticsSender = {
	pending,
	state,
	lastError,
	lastReportId,
	prepare,
	discard,
	confirmSend,
};
