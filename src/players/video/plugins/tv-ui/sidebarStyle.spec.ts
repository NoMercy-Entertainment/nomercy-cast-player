import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

function rule(selector: string): string {
	const start = css.indexOf(`${selector} {`);

	expect(start, `${selector} rule exists`).toBeGreaterThanOrEqual(0);

	return css.slice(start, css.indexOf('}', start));
}

// PlayerSettingsScreen.kt:483-491 (row) and :367-369 (focus ring), SettingsMainRow.
describe('settings sidebar rows match the KMP row', () => {
	it('rounds the row to 8px', () => {
		expect(rule('.tvui-sidebar .tvui-row')).toContain('border-radius: 8px');
	});

	it('pads the row 10px by 12px', () => {
		expect(rule('.tvui-sidebar .tvui-row')).toContain('padding: 10px 12px');
	});

	it('draws the focus ring as a rounded 2px inset ring, not an outline (Chrome 92 outlines ignore the radius)', () => {
		const ring = rule('.tvui-sidebar .tvui-row:focus-visible');

		expect(ring).toContain('box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.85)');
		expect(ring).toContain('background: rgb(255 255 255 / 0.06)');
		expect(ring).toContain('outline: 0');
	});

	it('does not fill the selected row (only focus fills)', () => {
		expect(rule('.tvui-sidebar .tvui-selected')).toContain('background: transparent');
	});

	it('puts the value on its own second line at 12px', () => {
		expect(rule('.tvui-sidebar .tvui-row-value')).toContain('font-size: 12px');
		expect(rule('.tvui-row-text')).toContain('flex-direction: column');
	});

	it('sets the header chevron ring to the same rounded 8px ring', () => {
		const ring = rule('.tvui-sidebar-header .tvui-icon-button:focus-visible');

		expect(ring).toContain('border-radius: 8px');
		expect(ring).toContain('box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.85)');
	});

	it('uses the system sans of the native app, not an unloaded Inter', () => {
		const tailwind = readFileSync(new URL('../../../../styles/tailwind.css', import.meta.url), 'utf8');

		expect(tailwind).not.toContain("'Inter'");
		expect(tailwind).toContain('Roboto');
	});
});
