import type { DiagnosticsCategoryValue, DiagnosticsCodeValue } from './events';
import { DiagnosticsRing } from './ring';

/**
 * The one ring every module records through. It is allocated at module load so
 * a call site never has to ask whether diagnostics were installed.
 */
export const diagnosticsRing = new DiagnosticsRing();

export function recordDiagnostic(
	category: DiagnosticsCategoryValue,
	code: DiagnosticsCodeValue,
	a = 0,
	b = 0,
	c = 0,
	label?: string,
): void {
	diagnosticsRing.record(category, code, a, b, c, label);
}
