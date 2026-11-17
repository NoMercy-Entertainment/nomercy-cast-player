import { describe, expect, it } from 'vitest';
import { decls } from '@/test/cssDecl';

// Every focusable draws its own KMP focus (a border, an inset ring or a fill). The global rule
// added a square outline on top (Chrome 92 cannot round an outline) and squared the element
// with border-radius: inherit: info buttons, music icon buttons, list rows, 28 of 51 in all.
describe('focus draws one ring, the component one, with its own radius', () => {
	it('the global focus rule paints no outline and keeps the radius', () => {
		const global = decls('styles/tv-safe.css', '[data-focusable]:focus-visible');

		expect(global.outline).toBe('none');
		expect(global['border-radius']).toBeUndefined();
	});

	// TvCardViewHolder.kt:79-102: the white ring replaces the palette stroke inside the cover.
	it('a focused group card rings its cover like a poster card', () => {
		expect(decls('server-components/NMGroupCard.vue', '.group-card:focus-visible .cover::after').border).toBe('2px solid var(--cast-white)');
	});
});
