// Censoring runs once, where a label is interned, so no recorder has to
// remember the rules. The default for an unrecognised word is to drop it: a
// report that loses a word is readable, a report that carries a viewer's
// library is not. See specs/nomercy-app-kmp/diagnostics-capture-everything.md.

const EMAIL = /^[^\s@]+@[^\s.@]+(?:\.[^\s.@]+)+$/;
const WINDOWS_PATH = /^[a-z]:[\\/]/i;
const UNC_PATH = /^\\\\/;
// Home roots only. `/media/` and `/mnt/` were here once and took `/media/1`
// with them — a route, not a disk. A real disk path is caught by its file
// extension instead.
const HOME_PATH = /^(?:~|\/home\/|\/users\/|\/root\/)/i;
const MEDIA_FILE = /\.(?:mkv|mp4|m4v|avi|mov|wmv|flv|webm|mp3|flac|m4a|wav|ogg|srt|ass|ssa|vtt|sub|idx|nfo)$/i;
const JWT = /^ey[\w-]{6,}\./;
const LONG_SECRET = /^[\w-]{40,}$/;
const NUMERIC = /^-?\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_ID = /^[0-9a-f]{12,64}$/i;
const LOWER_IDENT = /^[a-z][A-Za-z0-9]*$/;
const KEBAB_IDENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
// `Error` itself has no suffix to match, and it is the class most often thrown.
const ERROR_CLASS = /^(?:Error|[A-Z][A-Za-z0-9]*(?:Error|Exception))$/;
const HTTP_METHOD = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
const KEY_CODE = /^(?:Key[A-Z]|Digit\d|Numpad|F\d{1,2}$|Arrow(?:Up|Down|Left|Right)$|Space$|Enter$|Escape$|Tab$|Backspace$|Delete$|Insert$|Home$|End$|Page(?:Up|Down)$|Shift|Control|Alt|Meta|Caps|Media|Audio|Browser|Launch|Context|Print|Scroll|Pause$|Minus$|Equal$|Bracket|Semicolon$|Quote$|Backquote$|Backslash$|Comma$|Period$|Slash$|Unidentified$)/;
const WHITESPACE = /\s+/;

// A query value is private unless the key only describes the shape of the
// answer. `?q=` and `?access_token=` both keep their key and lose their value.
const SHAPE_ONLY_QUERY_KEYS = new Set([
	'page',
	'limit',
	'offset',
	'take',
	'skip',
	'sort',
	'order',
	'type',
	'kind',
	'version',
	'lang',
	'letter',
	'status',
	'state',
	'reverse',
]);

// Words a capitalised label part is allowed to keep. Each vocabulary owner
// registers its own names once — route names, kit event names — so the censor
// never has to guess whether a capitalised word is a screen or a track title.
const allowedWords = new Set<string>();

export function allowDiagnosticsWords(words: Iterable<string>): void {
	for (const word of words) {
		for (const part of String(word).split(WHITESPACE)) {
			if (part.length > 0)
				allowedWords.add(part);
		}
	}
}

/** Test-only escape hatch — production code never calls this. */
export function resetDiagnosticsWords(): void {
	allowedWords.clear();
}

function censorQueryPair(pair: string): string {
	const equals = pair.indexOf('=');
	if (equals < 0)
		return pair;

	const key = pair.slice(0, equals);
	if (SHAPE_ONLY_QUERY_KEYS.has(key.toLowerCase()))
		return pair;

	return `${key}=`;
}

function censorUrl(raw: string): string {
	let rest = raw;
	const scheme = rest.indexOf('://');

	if (scheme >= 0) {
		const afterHost = rest.indexOf('/', scheme + 3);
		rest = afterHost >= 0 ? rest.slice(afterHost) : '/';
	}

	if (HOME_PATH.test(rest) || MEDIA_FILE.test(rest))
		return '';

	const question = rest.indexOf('?');
	if (question < 0)
		return rest;

	const path = rest.slice(0, question);
	const query = rest.slice(question + 1)
		.split('&')
		.map(censorQueryPair)
		.join('&');

	return `${path}?${query}`;
}

function censorPart(part: string): string {
	if (EMAIL.test(part))
		return '';

	if (WINDOWS_PATH.test(part) || UNC_PATH.test(part) || HOME_PATH.test(part))
		return '';

	if (JWT.test(part))
		return '';

	// A relative route — `plugins/ui/browse` — is a route too. Left to the word
	// rules below it was dropped whole, and a report said `GET` with no path.
	if (part.includes('://') || part.includes('/') || part.includes('?'))
		return censorUrl(part);

	if (NUMERIC.test(part) || UUID.test(part) || HEX_ID.test(part))
		return part;

	if (LONG_SECRET.test(part))
		return '';

	if (HTTP_METHOD.test(part) || ERROR_CLASS.test(part) || KEY_CODE.test(part))
		return part;

	if (LOWER_IDENT.test(part))
		return part;

	if (KEBAB_IDENT.test(part))
		return part;

	if (allowedWords.has(part))
		return part;

	return '';
}

/**
 * The one place a private detail can be removed. Returns `undefined` when
 * nothing survived, which the ring stores as "this event has no name" rather
 * than as an empty name.
 */
export function censorLabel(label: string | undefined): string | undefined {
	if (!label)
		return undefined;

	const kept = label
		.trim()
		.split(WHITESPACE)
		.map(censorPart)
		.filter(part => part.length > 0);

	if (kept.length === 0)
		return undefined;

	return kept.join(' ');
}
