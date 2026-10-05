// Statically compare this receiver with the pinned media-server contract.
// update writes the inventory; check rejects stale inventory and unlisted drift.

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const CONTRACT = join(ROOT, 'contract');
const SERVER_REPO = 'NoMercy-Entertainment/nomercy-media-server';
const HUBS = ['VideoHub', 'MusicHub', 'DeviceHub', 'PluginHub'];
const QUOTED = /(?<q>['"`])(?<body>(?:\\.|(?!\k<q>)[^\\])*)\k<q>/;
const SOURCE_FILE_RE = /\.(?:ts|tsx|vue)$/;
const TEST_FILE_RE = /\.(?:test|spec)\.(?:ts|tsx)$/;
const HUB_BINDING_RE = /\b(?:const|let)\s+(\w+)\s*=\s*socketStore\.(\w+Hub)\.value/g;
const HUB_CALL_RE = /(?<receiver>(?:socketStore\.)?\w+(?:\.value)?)\s*\??\.\s*(?<kind>on|invoke|send)\s*\(\s*(?<q>['"`])(?<name>[^'"`]+)\k<q>/g;
const HUB_RECEIVER_RE = /(?:^|\.)(\w+Hub)(?:\.value)?$/;
const VALUE_SUFFIX_RE = /\.value$/;
const CONSTANT_RE = /\b(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*(?<q>['"`])(?<body>[^'"`$]*)\k<q>/g;
const DYNAMIC_SEGMENT_RE = /\$\{[^}]+\}/g;
const MIXED_SEGMENT_RE = /[^/]*\{x\}[^/]*/g;
const TRAILING_SLASH_RE = /\/+$/;
const API_FETCH_RE = /\bapiFetch(?:<[\s\S]*?>)?\s*\(\s*\{/g;
const METHOD_RE = /\bmethod\s*:\s*(?<q>['"`])(?<method>[A-Z]+)\k<q>/;
const UNKNOWN_PATH_RE = /\$\{(?:cleanLink|cleanPath|path\.replace)/;
const PATH_EXPRESSION_RE = /\bpath\s*:\s*([^,\n]+)/;
const HELPER_RE = /function\s+(\w+)\(hub:\s*TypedHub/g;
const HELPER_EVENT_RE = /\bhub\.on\(\s*(?<q>['"`])(?<event>[^'"`]+)\k<q>/g;
const HELPER_BINDING_RE = /\b(\w+)\((\w+Hub)\.value/g;
const FUNCTION_RE = /\bfunction\s+(\w+)\s*\([^)]*\)[^{]*\{/g;
const RETURN_RE = new RegExp(`\\breturn\\s+${QUOTED.source}`);
const BUILD_HUB_RE = /\bbuildHub\(\s*(?<q>['"`])(?<hub>\w+Hub)\k<q>/g;
const SERVER_PARAMETER_RE = /^\{[^}]+\}$/;
const NEWLINE_RE = /\r?\n/;
const SHA_RE = /^[0-9a-f]{40}$/;
const METHOD_SIGNATURE_RE = /\(.*/;

function filesAt(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory())
			return filesAt(path);
		return SOURCE_FILE_RE.test(name) && !TEST_FILE_RE.test(name) ? [path] : [];
	});
}

function sorted(items) {
	return [...items].sort((a, b) => a.localeCompare(b, 'en'));
}

function add(map, hub, name) {
	if (!map.has(hub))
		map.set(hub, new Set());
	map.get(hub).add(name);
}

function hubName(value) {
	return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function extractHubs(source, bindings = new Map()) {
	const invokes = new Map();
	const listens = new Map();
	for (const match of source.matchAll(HUB_BINDING_RE))
		bindings.set(match[1], hubName(match[2]));
	for (const match of source.matchAll(HUB_CALL_RE)) {
		const receiver = match.groups.receiver;
		const direct = receiver.match(HUB_RECEIVER_RE);
		const hub = bindings.get(receiver.replace(VALUE_SUFFIX_RE, '')) ?? (direct && hubName(direct[1]));
		if (hub && HUBS.includes(hub))
			add(match.groups.kind === 'on' ? listens : invokes, hub, match.groups.name);
	}
	return { invokes, listens };
}

function stringConstants(source) {
	const values = new Map();
	for (const match of source.matchAll(CONSTANT_RE))
		values.set(match[1], match.groups.body);
	return values;
}

function route(raw) {
	let path = raw.replace(DYNAMIC_SEGMENT_RE, '{x}').split('?')[0].split('#')[0];
	if (!path.startsWith('/api/v1/'))
		return undefined;
	path = path.replace(MIXED_SEGMENT_RE, '{x}').replace(TRAILING_SLASH_RE, '');
	return path;
}

// The text of the object literal whose `{` is at `start`, braces balanced.
function objectBody(source, start) {
	let depth = 0;
	for (let i = start; i < source.length; i++) {
		if (source[i] === '{')
			depth++;
		else if (source[i] === '}' && --depth === 0)
			return source.slice(start, i + 1);
	}
	return source.slice(start);
}

// `function name(...) { ... return 'route' }`: the first returned literal.
function functionReturns(source) {
	const values = new Map();
	for (const match of source.matchAll(FUNCTION_RE)) {
		const body = objectBody(source, match.index + match[0].length - 1);
		const returned = body.match(RETURN_RE);
		if (returned)
			values.set(match[1], returned.groups.body);
	}
	return values;
}

function extractHttp(source, constants = new Map(), returns = new Map()) {
	const http = new Set();
	const skips = [];
	const literal = new RegExp(`\\bpath\\s*:\\s*(?:${QUOTED.source}|(?<identifier>[A-Z][A-Z0-9_]*|[a-z]\\w*))`);
	for (const match of source.matchAll(API_FETCH_RE)) {
		const start = match.index;
		const body = objectBody(source, start + match[0].length - 1);
		const path = body.match(literal);
		if (!path)
			throw new Error(`apiFetch has no readable path at line ${source.slice(0, start).split('\n').length}`);
		const identifier = path.groups.identifier;
		const raw = path.groups.body ?? constants.get(identifier) ?? returns.get(identifier);
		const verb = body.match(METHOD_RE)?.groups.method ?? 'GET';
		const line = source.slice(0, start).split('\n').length;
		// useSearchQuery.ts: `/api/v1/search/${segment}` where segment is one of
		// two literal two-segment paths. A changed line no longer matches and
		// falls through to the "unresolved" error below.
		if (identifier === 'url' && source.includes('const segment = type === \'music\' ? \'music/tv\' : \'video/tv\'')) {
			http.add('GET /api/v1/search/music/tv');
			http.add('GET /api/v1/search/video/tv');
		}
		else if (raw && UNKNOWN_PATH_RE.test(raw)) {
			skips.push({ line, reason: 'Server-provided path can contain multiple segments', expression: raw });
		}
		else if (identifier === 'link') {
			skips.push({ line, reason: 'Server-provided link has no static route shape', expression: body.match(PATH_EXPRESSION_RE)?.[1]?.trim() ?? 'link' });
		}
		else if (raw) {
			const normalized = route(raw);
			if (!normalized)
				throw new Error(`unrecognized route at line ${line}: ${raw}`);
			http.add(`${verb} ${normalized}`);
		}
		else {
			throw new Error(`unresolved apiFetch path at line ${line}: ${identifier}`);
		}
	}
	return { http, skips };
}

function inventory(sources) {
	const invokes = new Map();
	const listens = new Map();
	const http = new Set();
	const skips = [];
	const constants = new Map();
	const returns = new Map();
	for (const { text } of sources) {
		for (const [key, value] of stringConstants(text))
			constants.set(key, value);
		for (const [key, value] of functionReturns(text))
			returns.set(key, value);
	}
	for (const { file, text: source } of sources) {
		const found = extractHubs(source);
		for (const [hub, names] of found.invokes) {
			for (const name of names)
				add(invokes, hub, name);
		}
		for (const [hub, names] of found.listens) {
			for (const name of names)
				add(listens, hub, name);
		}
		const calls = extractHttp(source, constants, returns);
		for (const entry of calls.http)
			http.add(entry);
		for (const skip of calls.skips)
			skips.push({ file: relative(ROOT, file).replace(/\\/g, '/'), ...skip });
	}
	// The listener helpers take a hub parameter; connectAll supplies its hub.
	const store = sources.find(s => s.file.endsWith('socketStore.ts'))?.text ?? '';
	const helperHubs = new Map();
	for (const match of store.matchAll(BUILD_HUB_RE)) {
		if (!HUBS.includes(hubName(match.groups.hub)))
			throw new Error(`unknown hub connection: ${match.groups.hub}`);
	}
	for (const match of store.matchAll(HELPER_BINDING_RE))
		add(helperHubs, match[1], hubName(match[2]));
	for (const match of store.matchAll(HELPER_RE)) {
		const helper = match[1];
		const next = store.indexOf('\nfunction ', match.index + 1);
		const body = store.slice(match.index, next < 0 ? undefined : next);
		for (const event of body.matchAll(HELPER_EVENT_RE)) {
			for (const hub of helperHubs.get(helper) ?? [])
				add(listens, hub, event.groups.event);
		}
	}
	return {
		hubs: Object.fromEntries(HUBS.map(hub => [hub, { invokes: sorted(invokes.get(hub) ?? []), listens: sorted(listens.get(hub) ?? []) }])),
		http: sorted(http),
		skips: skips.sort((a, b) => `${a.file}:${a.line}`.localeCompare(`${b.file}:${b.line}`, 'en')),
	};
}

function stringify(value) {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

// Every call form the extractor must read (each quote, a template, a constant,
// a function return, each verb, two calls in a row), with exactly what it gives.
const SELF_TEST_HTTP = [
	[`apiFetch({ path: '/api/v1/single' });`, ['GET /api/v1/single']],
	[`apiFetch({ path: "/api/v1/double", method: 'POST' });`, ['POST /api/v1/double']],
	[`apiFetch({ path: \`/api/v1/template/\${id}/x?q=\${q}\`, method: 'PUT' });`, ['PUT /api/v1/template/{x}/x']],
	[`apiFetch({ path: ROUTE, method: 'PATCH' });`, ['PATCH /api/v1/constant']],
	[`apiFetch({ path: routeFor(id), method: 'DELETE' });`, ['DELETE /api/v1/function/{x}/view']],
	[`apiFetch({ path: '/api/v1/first' });\napiFetch({ path: '/api/v1/second', method: 'POST' });`, ['GET /api/v1/first', 'POST /api/v1/second']],
];

const SELF_TEST_HUB = [
	[`socketStore.musicHub.value?.invoke('DirectMethod');`, { invokes: ['DirectMethod'] }],
	[`const hub = socketStore.musicHub.value;\nhub.send("BoundSent");`, { invokes: ['BoundSent'] }],
	['musicHub.value?.on(`TemplateEvent`, () => {});', { listens: ['TemplateEvent'] }],
];

const SELF_TEST_HELPER = `function bindFixture(hub: TypedHub): void {\n\thub.on('HelperEvent', () => {});\n}\nbindFixture(musicHub.value);`;

function selfTest() {
	let failures = 0;
	const expect = (label, want, got) => {
		if (JSON.stringify(sorted(got)) !== JSON.stringify(sorted(want))) {
			failures++;
			console.log(`FAIL ${label.split(NEWLINE_RE).join(' ')}\n  want [${sorted(want).join(', ')}]\n  got  [${sorted(got).join(', ')}]`);
		}
	};
	const constants = new Map([['ROUTE', '/api/v1/constant']]);
	const returns = new Map([['routeFor', `/api/v1/function/\${id}/view?x=1`]]);
	for (const [source, want] of SELF_TEST_HTTP) {
		let got;
		try {
			got = extractHttp(source, constants, returns).http;
		}
		catch (error) {
			got = [`error: ${error.message}`];
		}
		expect(source, want, got);
	}
	for (const [source, want] of SELF_TEST_HUB) {
		const found = extractHubs(source);
		expect(source, want.invokes ?? [], found.invokes.get('MusicHub') ?? []);
		expect(source, want.listens ?? [], found.listens.get('MusicHub') ?? []);
	}
	const helper = inventory([{ file: join(SRC, 'stores/socketStore.ts'), text: SELF_TEST_HELPER }]);
	expect(SELF_TEST_HELPER, ['HelperEvent'], helper.hubs.MusicHub.listens);
	const total = SELF_TEST_HTTP.length + SELF_TEST_HUB.length + 1;
	console.log(`self-test: ${total - failures} of ${total} call forms read`);
	return failures;
}

function routeMatches(client, server) {
	const left = client.toLowerCase().split('/');
	const right = server.toLowerCase().split('/');
	return left.length === right.length && left.every((part, i) => part === '{x}' || SERVER_PARAMETER_RE.test(right[i]) || part === right[i]);
}

async function serverContract() {
	const sha = readFileSync(join(CONTRACT, 'server-ref'), 'utf8').split(NEWLINE_RE).find(line => SHA_RE.test(line));
	if (!sha)
		throw new Error('contract/server-ref has no 40-hex sha');
	const read = async (name) => {
		if (process.env.CONTRACT_SERVER_DIR)
			return JSON.parse(readFileSync(join(process.env.CONTRACT_SERVER_DIR, name), 'utf8'));
		const response = await fetch(`https://raw.githubusercontent.com/${SERVER_REPO}/${sha}/${name}`);
		if (!response.ok)
			throw new Error(`${name}: HTTP ${response.status}`);
		return response.json();
	};
	const [openapi, signalr] = await Promise.all([read('openapi.json'), read('signalr-contracts.json')]);
	return { sha, openapi, signalr };
}

function missingFrom(client, server) {
	const missing = new Set();
	for (const [hub, calls] of Object.entries(client.hubs)) {
		const methods = new Set((server.signalr.hubs[hub] ?? []).map(name => name.replace(METHOD_SIGNATURE_RE, '')));
		for (const name of calls.invokes) {
			if (!methods.has(name))
				missing.add(`hub ${hub}.${name}`);
		}
		// Current signalr-contracts.json has no outbound event section. Treat
		// every listener as drift until the server publishes that contract.
		const events = new Set(server.signalr.events?.[hub] ?? []);
		for (const name of calls.listens) {
			if (!events.has(name))
				missing.add(`event ${hub}.${name}`);
		}
	}
	for (const entry of client.http) {
		const [verb, path] = entry.split(' ');
		if (!Object.entries(server.openapi.paths).some(([p, ops]) => routeMatches(path, p) && verb.toLowerCase() in ops))
			missing.add(`http ${entry}`);
	}
	return missing;
}

async function main() {
	const mode = process.argv[2] ?? 'check';
	if (mode === 'self-test') {
		process.exitCode = selfTest() ? 1 : 0;
		return;
	}
	if (!['update', 'check'].includes(mode))
		throw new Error('usage: node scripts/contract-diff.mjs [self-test|update|check]');
	const fresh = inventory(filesAt(SRC).map(file => ({ file, text: readFileSync(file, 'utf8') })));
	const clientFile = join(CONTRACT, 'client-contract.json');
	if (mode === 'update') {
		mkdirSync(CONTRACT, { recursive: true });
		writeFileSync(clientFile, stringify(fresh));
		console.log(`wrote contract/client-contract.json: ${Object.keys(fresh.hubs).length} hubs, ${fresh.http.length} routes, ${fresh.skips.length} documented skips`);
		return;
	}
	let failures = 0;
	if (readFileSync(clientFile, 'utf8') !== stringify(fresh)) {
		console.log('STALE contract/client-contract.json differs from src/; run update');
		failures++;
	}
	const server = await serverContract();
	const missing = missingFrom(fresh, server);
	const known = JSON.parse(readFileSync(join(CONTRACT, 'known-drift.json'), 'utf8'));
	const items = new Set(known.map(entry => `${entry.kind} ${entry.item}`));
	for (const entry of known) {
		if (!['hub', 'event', 'http'].includes(entry.kind) || typeof entry.item !== 'string' || typeof entry.reason !== 'string' || !entry.reason.trim() || entry.reason.includes('\n')) {
			console.log(`INVALID known drift entry: ${JSON.stringify(entry)}`);
			failures++;
		}
	}
	if (items.size !== known.length) {
		console.log('DUPLICATE known drift entry');
		failures++;
	}
	for (const item of sorted(missing)) {
		if (!items.has(item)) {
			console.log(`MISSING ${item}`);
			failures++;
		}
	}
	for (const item of sorted(items)) {
		if (!missing.has(item)) {
			console.log(`RESOLVED ${item}`);
			failures++;
		}
	}
	console.log(`contract: ${Object.keys(fresh.hubs).length} hubs, ${Object.values(fresh.hubs).reduce((n, h) => n + h.invokes.length, 0)} methods, ${Object.values(fresh.hubs).reduce((n, h) => n + h.listens.length, 0)} events, ${fresh.http.length} routes; ${missing.size} known drift; ${failures} failure(s); server ${server.sha.slice(0, 7)}`);
	process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
