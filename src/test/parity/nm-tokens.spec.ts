import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const ROOT = path.resolve(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
	return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter(e => e.isFile() && /\.(?:vue|css|ts)$/.test(e.name) && !/\.(?:test|spec)\./.test(e.name))
		.map(e => path.join(e.parentPath, e.name));
}

// The values are app-web's dark :root block (src/components/nm/tokens.css), copied by scripts/sync-nm-tokens.mjs.
describe('the receiver reads the NM design tokens', () => {
	const nm = decls('styles/nm-tokens.css', ':root');

	it('copies the dark roles the receiver reads', () => {
		expect(nm['--nm-text-primary']).toBe('#EDEDED');
		expect(nm['--nm-surface']).toBe('#161616');
		expect(nm['--nm-gray-3']).toBe('#222222');
		expect(nm['--nm-red-11']).toBe('#ff9592');
	});

	it('holds nothing the Cast browser (Chrome 92) cannot read', () => {
		const css = fs.readFileSync(path.join(ROOT, 'src/styles/nm-tokens.css'), 'utf8');
		expect(css).not.toMatch(/oklch|oklab|lab\(|lch\(|color-mix|@layer/);
	});

	it('defines every --nm- name a source file reads', () => {
		const used = new Set<string>();
		for (const file of sourceFiles(path.join(ROOT, 'src'))) {
			for (const m of fs.readFileSync(file, 'utf8').matchAll(/var\((--nm-[\w-]+)/g))
				used.add(m[1]);
		}
		expect([...used].filter(name => !(name in nm))).toEqual([]);
	});

	it('keeps the colors NM has no opaque token for in tokens.css', () => {
		const own = decls('styles/tokens.css', ':root');
		expect([own['--cast-white'], own['--cast-black'], own['--cast-skip-bg'], own['--cast-skip-ink']])
			.toEqual(['#fff', '#000', '#262630eb', '#262630']);
	});
});

describe('no raw hex color outside the token files', () => {
	function run(dir: string): { status: number; out: string } {
		try {
			const out = execFileSync('node', ['scripts/check-cast-css.mjs', dir], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
			return { status: 0, out };
		}
		catch (error) {
			const e = error as { status: number; stderr: string };
			return { status: e.status, out: e.stderr };
		}
	}

	it('check:css passes over src', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cast-css-'));
		const css = path.join(dir, 'empty.css');
		fs.writeFileSync(css, ':root{--a:1}');
		const { status, out } = run(dir);
		fs.unlinkSync(css);
		fs.rmdirSync(dir);
		expect(out.split('\n').filter(l => l.includes('raw hex color')).slice(0, 5)).toEqual([]);
		expect(status).toBe(0);
	});
});
