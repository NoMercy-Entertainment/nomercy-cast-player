import { DiagnosticsCategory, DiagnosticsCode } from './events';
import { allowDiagnosticsWords } from './censor';
import { recordDiagnostic } from './sink';

// What a value that is not an object carries instead of a class name. A thrown
// string has a constructor too, and `String` would read as a class the
// receiver defined.
const NON_ERROR = 'nonError';

/**
 * The class name of what was thrown. The message never travels: a message is
 * prose and can carry a title, a path or a token, and the censor must not be
 * the only thing standing between a message and the report.
 */
export function swallowedClassName(error: unknown): string {
	if (error === null || typeof error !== 'object')
		return NON_ERROR;

	const name = (error as { constructor?: { name?: unknown } }).constructor?.name;

	return typeof name === 'string' && name.length > 0 ? name : NON_ERROR;
}

/**
 * Records a failure the receiver caught and deliberately does nothing about.
 * The console tap covers every catch that logs; this covers the ones that do
 * not, which are otherwise invisible to a report.
 * See specs/nomercy-app-kmp/diagnostics-capture-everything.md.
 */
export function recordSwallowed(where: string, error: unknown): void {
	const className = swallowedClassName(error);

	// Both parts are source identifiers, not user data, so they are registered
	// the same way route and event vocabularies are.
	allowDiagnosticsWords([className, where]);
	recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ErrorCaught, 0, 0, 0, `${className} ${where}`);
}
