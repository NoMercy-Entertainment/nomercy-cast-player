import { DiagnosticsCategory, DiagnosticsCode } from './events';
import { recordDiagnostic } from './sink';

const WHITESPACE = /\s+/;

/**
 * The name a caught failure can be recorded under. An error message is prose
 * and can carry a title, a path or a token, so only the class name and the
 * first word of the call travel — the censor drops the rest anyway, and this
 * keeps the label table from filling with one entry per unique message.
 */
export function caughtLabel(args: readonly unknown[]): string | undefined {
	const parts: string[] = [];

	for (const arg of args) {
		if (arg instanceof Error) {
			parts.push(arg.name);
			continue;
		}

		if (typeof arg === 'string' && parts.length === 0)
			parts.push(arg.split(WHITESPACE)[0] ?? '');
	}

	const label = parts.filter(part => part.length > 0).join(' ');

	return label.length > 0 ? label : undefined;
}

// Per console, not per module: wrapping the same console twice would record
// every error twice, and a test that hands over its own console still gets one.
const installed = new WeakSet<Console>();

/**
 * Records every error and warning the receiver hands to the console, including
 * the ones it catches and swallows. Nobody is sitting in front of a television
 * reading its console, which is what makes this the only copy that survives.
 * See specs/nomercy-app-kmp/diagnostics-capture-everything.md.
 */
export function installDiagnosticsConsoleTap(target: Console = console): void {
	if (installed.has(target))
		return;
	installed.add(target);

	const originalError = target.error.bind(target);
	const originalWarn = target.warn.bind(target);

	target.error = (...args: unknown[]) => {
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ErrorCaught, args.length, 0, 0, caughtLabel(args));
		originalError(...args);
	};

	target.warn = (...args: unknown[]) => {
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.WarningLogged, args.length, 0, 0, caughtLabel(args));
		originalWarn(...args);
	};
}
