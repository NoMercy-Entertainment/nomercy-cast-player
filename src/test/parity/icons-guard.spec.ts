import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const SVG_HOLDERS = ['components/icons/MoooomIcon.vue', 'layout/AppLogo.vue', 'layout/AppLogoSquare.vue'];

function sourceFiles(dir: string): string[] {
	return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter(entry => entry.isFile() && /\.(?:vue|ts)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name))
		.map(entry => path.join(entry.parentPath, entry.name));
}

describe('receiver icon guard', () => {
	it('holds an inline <svg> only in MoooomIcon and the two logo files', () => {
		const holders = sourceFiles(ROOT)
			.filter(file => fs.readFileSync(file, 'utf8').includes('<svg'))
			.map(file => path.relative(ROOT, file).replaceAll('\\', '/'));

		expect(holders.sort()).toEqual([...SVG_HOLDERS].sort());
	});
});
