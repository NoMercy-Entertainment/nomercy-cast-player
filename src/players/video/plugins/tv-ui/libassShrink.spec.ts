import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';

// The vitest css option blanks imported stylesheets, so the source is read directly.
const css = readFileSync('src/players/video/plugins/tv-ui/style.css', 'utf8');

afterEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
});

// nomercy-subtitle-octopus mirrors its geometry source's transform onto .libassjs-canvas-parent.
// The source is the box that also holds it, so a sync during the settings shrink applied it twice
// and left the subtitle small and off-center after the picture grew back.
it('the libass canvas never takes a copy of the box shrink', () => {
	const style = document.createElement('style');

	style.textContent = css;
	document.head.append(style);

	const box = document.createElement('div');
	const canvasParent = document.createElement('div');

	box.className = 'nomercy-libass-box';
	canvasParent.className = 'libassjs-canvas-parent';
	canvasParent.style.transform = 'translate(148px, 0px) scale(0.6171875)';
	box.append(canvasParent);
	document.body.append(box);

	expect(getComputedStyle(canvasParent).transform).toBe('none');
});

// nomercy-video-player sizes text cues in cqi (subtitle-overlay); Chrome 92 drops that declaration.
it('text subtitles keep a size that follows the screen where cqi is missing', () => {
	const block = css.slice(css.indexOf('@supports not (width: 1cqi)'));

	expect(block).toContain('.subtitle-overlay .subtitle-area');
	expect(block).toContain('font-size: clamp(14px, calc(var(--subtitle-scale, 1) * 2.5vw), 56px);');
});
