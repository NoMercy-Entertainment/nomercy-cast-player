// Fails when built CSS or JS holds a known unsupported Chrome 80 feature without its fallback.
// Usage: node scripts/check-cast-css.mjs [assetsDir]   (default: docs/assets, the build outDir)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const BACKDROP = ['backdrop', 'filter'].join('-');
const FEATURES = [
	['lab()', /(?<![\w-])lab\(/g],
	['oklab()', /(?<![\w-])oklab\(/g],
	['lch()', /(?<![\w-])lch\(/g],
	['oklch()', /(?<![\w-])oklch\(/g],
	['color-mix()', /(?<![\w-])color-mix\(/g],
	['@layer', /@layer\b/g],
	// A blur over the TV's hardware video plane flashes between the blurred and the raw frame.
	// Built from parts: Tailwind scans this file and would emit a utility for the whole word.
	[BACKDROP, new RegExp(`(?<![\\w-])(?:-webkit-)?${BACKDROP}\\s*:`, 'g')],
];
const MODERN = /(?<![\w-])(?:ok)?l(?:ab|ch)\(|(?<![\w-])color-mix\(/;

function lineOf(text, index) {
	return text.slice(0, index).split('\n').length;
}

export function findIssues(css, file) {
	const text = css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
	const issues = [];
	for (const [name, re] of FEATURES) {
		for (const m of text.matchAll(re))
			issues.push({ file, name, line: lineOf(text, m.index), snippet: text.slice(m.index, m.index + 70).split('\n')[0] });
	}
	for (const block of text.matchAll(/\{([^{}]*)\}/g)) {
		const last = new Map();
		for (const d of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]*)/g))
			last.set(d[1], { value: d[2], index: block.index + 1 + d.index });
		for (const [prop, { value, index }] of last) {
			if (MODERN.test(value))
				issues.push({ file, name: 'custom property', line: lineOf(text, index), snippet: `${prop}:${value}`.slice(0, 70) });
		}
	}
	return issues;
}

// Built-ins newer than Chrome 80. A window bundle may use one only when chrome92Polyfills.ts lists it.
// Vue's reactive array wrappers call the array methods as `fn(this).toSorted(`; nothing in src uses them.
const JS_APIS = [
	['Object.hasOwn', /\bObject\.hasOwn\b/g],
	['Array.prototype.at', /\.at\(/g],
	['String.prototype.replaceAll', /\.replaceAll\(/g],
	['ParentNode.replaceChildren', /\.replaceChildren\(/g],
	['Promise.any', /\bPromise\.any\b/g],
	['WeakRef', /\bnew\s+(?:WeakRef|FinalizationRegistry)\b/g],
	['structuredClone', /(?<![.\w])structuredClone\s*\(/g],
	['Array.prototype.findLast', /\.findLast(?:Index)?\(/g],
	['Array.prototype.toSorted', /(?<!\(this\))\.(?:toSorted|toReversed|toSpliced)\(/g],
	['Object.groupBy', /\b(?:Object|Map)\.groupBy\b/g],
	['Promise.withResolvers', /\bPromise\.withResolvers\b/g],
	['AbortSignal.timeout', /\bAbortSignal\.(?:timeout|any)\b/g],
	['Array.fromAsync', /\bArray\.fromAsync\b/g],
	['String.prototype.isWellFormed', /\.(?:is|to)WellFormed\(/g],
	['URL.canParse', /\bURL\.canParse\b/g],
	['Set.prototype.union', /\.(?:union|intersection|difference|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/g],
];

export function findJsIssues(js, file, polyfilled) {
	return JS_APIS.filter(([name]) => !polyfilled.includes(name)).flatMap(([name, re]) =>
		[...js.matchAll(re)].map(m => ({ file, name, line: lineOf(js, m.index), snippet: js.slice(Math.max(0, m.index - 20), m.index + 50).split('\n')[0] })));
}

const JS_FILE = /\.js$/;
const POLYFILL_LIST = /POLYFILLED\s*=\s*\[([^\]]*)\]/;

function readPolyfilled() {
	const source = readFileSync('src/lib/chrome92Polyfills.ts', 'utf8');
	const list = source.match(POLYFILL_LIST);
	if (!list)
		throw new Error('check-cast-css: src/lib/chrome92Polyfills.ts has no POLYFILLED list');
	return [...list[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

// Colors come from the NM tokens (src/styles/nm-tokens.css). A hex color may sit only in the token
// files and in the two brand logo files, which keep their own artwork.
const HEX_HOLDERS = ['src/styles/tokens.css', 'src/styles/nm-tokens.css', 'src/layout/AppLogo.vue', 'src/layout/AppLogoSquare.vue'];
const HEX = /(?<![\w&#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![\w-])/gi;
const SOURCE_FILE = /\.(?:vue|css|ts)$/;
const TEST_FILE = /\.(?:test|spec)\./;

export function findRawHex(text, file) {
	if (HEX_HOLDERS.includes(file.replaceAll('\\', '/')))
		return [];
	const code = text
		.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
		.replace(/^\s*\/\/.*$/gm, m => m.replace(/[^\n]/g, ' '));
	return [...code.matchAll(HEX)].map(m => ({ file, name: 'raw hex color', line: lineOf(code, m.index), snippet: code.slice(Math.max(0, code.lastIndexOf('\n', m.index) + 1), m.index + 40).split('\n')[0].trim() }));
}

function scanSource(dir) {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter(e => e.isFile() && SOURCE_FILE.test(e.name) && !TEST_FILE.test(e.name))
		.flatMap((e) => {
			const path = join(e.parentPath, e.name);
			return findRawHex(readFileSync(path, 'utf8'), path.replaceAll('\\', '/'));
		});
}

function selfTest() {
	const plantedHex = ['<style>\n.x { color: #fff; }\n</style>', '.x{background:#1a1a1a}', '.x{border:1px solid #AABBCCDD}', '.x{color:#abc}'];
	for (const text of plantedHex) {
		if (findRawHex(text, 'src/views/Planted.vue').length === 0)
			throw new Error(`self-test: planted hex not found: ${text}`);
	}
	const controls = ['.x{color:var(--nm-text-primary)}', '/* #fff in a comment */ .x{color:rgb(255 255 255 / .5)}', 'a[href="#top"]{}', '.x{color:#fff}'];
	for (const [i, text] of controls.entries()) {
		const file = i === 3 ? 'src/styles/tokens.css' : 'src/views/Control.vue';
		if (findRawHex(text, file).length !== 0)
			throw new Error(`self-test: hex control must pass: ${text}`);
	}
	const plantedJs = [
		'if(Object.hasOwn(a,`x`))b()',
		'a.at(-1)',
		's.replaceAll(a,b)',
		'element.replaceChildren(a,b)',
		'Promise.any(a)',
		'new WeakRef(a)',
		'let c=structuredClone(a)',
		'a.findLast(f)',
		'a.findLastIndex(f)',
		'a.toSorted(f)',
		'Object.groupBy(a,f)',
		'Promise.withResolvers()',
		'AbortSignal.timeout(5)',
		'Array.fromAsync(a)',
		's.isWellFormed()',
		'URL.canParse(u)',
		'new Set(a).union(b)',
	];
	for (const js of plantedJs) {
		if (findJsIssues(js, 'planted.js', []).length === 0)
			throw new Error(`self-test: planted built-in not found: ${js}`);
	}
	if (findJsIssues('Object.hasOwn(a,b)', 'covered.js', ['Object.hasOwn']).length !== 0)
		throw new Error('self-test: a polyfilled built-in must pass');
	if (findJsIssues('toReversed(){return ot(this).toReversed()},toSorted(e){return ot(this).toSorted(e)}', 'vue.js', []).length !== 0)
		throw new Error('self-test: the Vue array wrappers must pass');
	const clean = ':root{--a:#9e9e9e;--b:rgb(10 20 30 / 50%)}.x{color:var(--a);background:rgba(0,0,0,.5)}';
	const planted = [
		'.x{color:lab(65.2% 0 0)}',
		'.x{color:oklab(0.6 0 0)}',
		'.x{color:lch(65% 0 0)}',
		'.x{color:oklch(0.6 0 0)}',
		'.x{color:color-mix(in srgb,red,blue)}',
		'@layer base{.x{color:red}}',
		':root{--a:#fff;--a:lab(65.2% 0 0)}',
		`.panel{${BACKDROP}:blur(8px)}`,
		`.panel{-webkit-${BACKDROP}:blur(8px)}`,
	];
	if (findIssues(clean, 'control').length !== 0)
		throw new Error('self-test: the hex and rgb() control must pass');
	for (const css of planted) {
		if (findIssues(css, 'planted').length === 0)
			throw new Error(`self-test: planted defect not found: ${css}`);
	}
}

const dir = process.argv[2] ?? 'docs/assets';
selfTest();
const files = readdirSync(dir).filter(f => f.endsWith('.css'));
if (files.length === 0) {
	console.error(`check-cast-css: no .css files in ${dir}; build first`);
	process.exit(2);
}
const polyfilled = readPolyfilled();
// Default: the whole build output (assets and the copied octopus worker). A given css dir scans itself.
const jsRoot = process.argv[3] ?? (process.argv[2] ? dir : join(dir, '..'));
const jsFiles = readdirSync(jsRoot, { recursive: true, withFileTypes: true })
	.filter(e => e.isFile() && JS_FILE.test(e.name))
	.map(e => join(e.parentPath, e.name));
const issues = [
	...files.flatMap(f => findIssues(readFileSync(join(dir, f), 'utf8'), f)),
	...jsFiles.flatMap((f) => {
		const file = f.replaceAll('\\', '/');
		// A window prototype shim does not install into the copied worker's global scope.
		return findJsIssues(readFileSync(f, 'utf8'), file, file.includes('/js/') ? [] : polyfilled);
	}),
	...scanSource('src'),
];
if (issues.length > 0) {
	const counts = new Map();
	for (const i of issues)
		counts.set(i.name, (counts.get(i.name) ?? 0) + 1);
	console.error(`check-cast-css: ${issues.length} findings the Cast receiver must not ship (${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')})`);
	for (const i of issues)
		console.error(`  ${i.name} ${i.file}:${i.line} ${i.snippet}`);
	process.exit(1);
}
console.log(`check-cast-css: ${files.length} css and ${jsFiles.length} js files, no known Chrome 80 findings, no raw hex in src (self-test ok)`);
