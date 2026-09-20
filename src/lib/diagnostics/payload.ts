import type { DiagnosticsEntry } from './events';
import type { DeviceFacts } from './deviceFacts';
import { renderDiagnosticsReport } from './report';

export type DiagnosticsReportKind = 'crash' | 'manual';

/**
 * The wire shape `POST /v1/diagnostics/reports` requires. Field names and
 * casing are the contract; see specs/nomercy-tv/diagnostics-inbox.md.
 */
export interface DiagnosticsReportRequest {
	device_id: string;
	kind: DiagnosticsReportKind;
	app_version: string;
	model: string;
	abi: string;
	platform_version: string;
	heap_ceiling_mb: number;
	heap_used_mb: number;
	threads: number;
	events_held: number;
	events_dropped: number;
	body: string;
}

export interface DiagnosticsReportResponse {
	id: string;
}

export interface BuildReportInput {
	deviceId: string;
	kind: DiagnosticsReportKind;
	facts: DeviceFacts;
	entries: DiagnosticsEntry[];
	recorded: number;
}

/**
 * The only place a payload is built, so the preview the user approves can never
 * say something different from what leaves the device.
 */
export function buildDiagnosticsReport(input: BuildReportInput): DiagnosticsReportRequest {
	const held = input.entries.length;
	const dropped = Math.max(input.recorded - held, 0);

	return {
		device_id: input.deviceId,
		kind: input.kind,
		app_version: input.facts.appVersion,
		model: input.facts.model,
		abi: input.facts.abi,
		platform_version: input.facts.platformVersion,
		heap_ceiling_mb: input.facts.heapCeilingMb,
		heap_used_mb: input.facts.heapUsedMb,
		threads: input.facts.threads,
		events_held: held,
		events_dropped: dropped,
		body: renderDiagnosticsReport(input.facts, input.entries, dropped),
	};
}
