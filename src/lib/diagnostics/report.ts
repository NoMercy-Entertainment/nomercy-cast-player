import type { DiagnosticsEntry } from './events';
import type { DeviceFacts } from './deviceFacts';

function heapLine(facts: DeviceFacts): string {
	const heap = facts.heapCeilingMb > 0
		? `${facts.heapUsedMb}MB of ${facts.heapCeilingMb}MB`
		: 'unavailable';
	const threads = facts.threads > 0 ? `${facts.threads} threads` : 'threads unavailable';
	return `heap ${heap}, ${threads}`;
}

function line(entry: DiagnosticsEntry, startMs: number): string {
	const offset = Math.round(entry.atMs - startMs);
	const fields = [entry.a, entry.b, entry.c].filter(value => value !== 0).join(' ');
	return `+${offset}ms ${entry.category} ${entry.code} ${fields}`.trimEnd();
}

/** What the user sees before it is sent, and what we read when it arrives. */
export function renderDiagnosticsReport(
	facts: DeviceFacts,
	entries: DiagnosticsEntry[],
	dropped: number,
): string {
	const header = [
		`app ${facts.appVersion}`,
		`device ${facts.model} ${facts.abi} cast ${facts.platformVersion}`,
		heapLine(facts),
		`events ${entries.length} held, ${dropped} dropped`,
		'',
	];
	const startMs = entries.length > 0 ? entries[0].atMs : 0;

	return [...header, ...entries.map(entry => line(entry, startMs))].join('\n');
}
