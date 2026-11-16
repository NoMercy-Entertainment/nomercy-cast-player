import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectIconNames, parseSprite, scanSourceDir, usedIconModule } from '../../tooling/vite/moooomIcons';

const RESOURCES = path.resolve(__dirname, '../../resources');
const SRC_DIR = path.resolve(__dirname, '..');

const miniSprite = `<svg width="0" height="0" style="display: none;">
	<symbol id="alpha" xmlns="http://www.w3.org/2000/svg" fill="var(--fill-color, none)" viewBox="0 0 24 24">
		<path stroke="currentColor"
			stroke-width="var(--stroke-width,1.5)"
			d="M1 1h2"/>
	</symbol>
	<symbol id="beta" xmlns="http://www.w3.org/2000/svg" fill="var(--fill-color, none)" viewBox="0 0 19 18">
		<path stroke="currentColor" d="M2 2h2"/>
	</symbol>
</svg>`;

describe('moooomIcons plugin', () => {
	it('keeps the viewBox, the root fill hook and the stroke hook of a symbol', () => {
		const icons = parseSprite(miniSprite);

		expect(icons.alpha).toEqual({
			viewBox: '0 0 24 24',
			fill: 'var(--fill-color, none)',
			body: '<path stroke="currentColor" stroke-width="var(--stroke-width,1.5)" d="M1 1h2"/>',
		});
		expect(icons.beta?.viewBox).toBe('0 0 19 18');
	});

	it('includes only the icons the sources name, also inside a ternary', () => {
		const icons = parseSprite(miniSprite);
		const used = collectIconNames(['const x = on ? \'beta\' : \'delta\';'], new Set(Object.keys(icons)));

		expect([...used]).toEqual(['beta']);
		expect(usedIconModule(icons, used)).not.toContain('"alpha"');
	});

	it('reads every symbol of both shipped sprites', () => {
		for (const file of ['mooooom-icons.svg', 'player-icons.svg']) {
			const sprite = fs.readFileSync(path.join(RESOURCES, file), 'utf8');
			expect(Object.keys(parseSprite(sprite)).length, file).toBe(sprite.split('<symbol ').length - 1);
		}
	});

	it('finds an icon the receiver sources name inside the sprites', () => {
		const sprites = ['mooooom-icons.svg', 'player-icons.svg'].map(file => fs.readFileSync(path.join(RESOURCES, file), 'utf8'));
		const known = new Set(sprites.flatMap(sprite => Object.keys(parseSprite(sprite))));
		const used = collectIconNames(scanSourceDir(SRC_DIR), known);

		expect(used.has('film')).toBe(true);
	});
});
