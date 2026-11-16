// Fails when the built CSS holds a feature the Cast device browser (Chrome 92) cannot read.
// Usage: node scripts/check-cast-css.mjs [assetsDir]   (default: docs/assets, the build outDir)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const FEATURES = [
	['lab()', /(?<![\w-])lab\(/g],
	['oklab()', /(?<![\w-])oklab\(/g],
	['lch()', /(?<![\w-])lch\(/g],
	['oklch()', /(?<![\w-])oklch\(/g],
	['color-mix()', /(?<![\w-])color-mix\(/g],
	['@layer', /@layer\b/g],
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

function selfTest() {
	const clean = ':root{--a:#9e9e9e;--b:rgb(10 20 30 / 50%)}.x{color:var(--a);background:rgba(0,0,0,.5)}';
	const planted = [
		'.x{color:lab(65.2% 0 0)}',
		'.x{color:oklab(0.6 0 0)}',
		'.x{color:lch(65% 0 0)}',
		'.x{color:oklch(0.6 0 0)}',
		'.x{color:color-mix(in srgb,red,blue)}',
		'@layer base{.x{color:red}}',
		':root{--a:#fff;--a:lab(65.2% 0 0)}',
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
const issues = files.flatMap(f => findIssues(readFileSync(join(dir, f), 'utf8'), f));
if (issues.length > 0) {
	const counts = new Map();
	for (const i of issues)
		counts.set(i.name, (counts.get(i.name) ?? 0) + 1);
	console.error(`check-cast-css: ${issues.length} findings Chrome 92 cannot read (${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')})`);
	for (const i of issues)
		console.error(`  ${i.name} ${i.file}:${i.line} ${i.snippet}`);
	process.exit(1);
}
console.log(`check-cast-css: ${files.length} css files, no Chrome 92 findings (self-test ok)`);
