import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The vitest css option blanks imported stylesheets, so the source is read directly.
const css = readFileSync('src/players/video/plugins/tv-ui/style.css', 'utf8');

function rule(selector: string): string {
	const start = css.indexOf(`\n${selector} {`);

	if (start < 0) return '';

	return css.slice(start, css.indexOf('}', start));
}

// Chrome 92 draws an outline square, so a ring on a rounded element is a box-shadow.
describe('focus rings follow the corner radius', () => {
	it.each([
		'.tvui-icon-button:focus-visible',
		'.tvui-button:focus-visible',
		'.tvui-row:focus-visible',
		'.tvui-card:focus-visible',
		'.tvui-seek-selected',
	])('%s draws a box-shadow, not an outline', (selector) => {
		const blocks = css.split('}').filter((block) => block.slice(0, block.indexOf('{')).includes(selector));
		const body = blocks.join('}');

		expect(body).toContain('box-shadow');
		// The seek tile keeps the 8 px radius of its base rule.
		expect(body.includes('border-radius') || selector === '.tvui-seek-selected').toBe(true);
		expect(body).not.toMatch(/outline:\s*(?!0)\S/);
	});
});

// PlayerUiHelpers.kt:51-80 (2dp circle ring), TVTopBar.kt:85-100 (IconButton 48dp),
// TvSelectableMenuItem.kt:55-63 (3dp, 12dp), EpisodeCard.kt:65-87 (3dp, 8dp, art 6dp, 180dp),
// CenterMessage.kt:36-43 (8dp, 16x8).
describe('radii and sizes match the native player', () => {
	it('top bar buttons are 48 px circles', () => {
		expect(rule('.tvui-top-bar .tvui-icon-button')).toContain('padding: 12px');
	});

	it('the center message has an 8 px radius and 16x8 padding', () => {
		const block = rule('.tvui-center-message');

		expect(block).toContain('border-radius: 8px');
		expect(block).toContain('padding: 8px 16px');
	});

	it('the episode art has a 6 px radius and is 180 px wide', () => {
		const block = rule('.tvui-card-art');

		expect(block).toContain('border-radius: 6px');
		expect(block).toContain('width: 180px');
	});
});
