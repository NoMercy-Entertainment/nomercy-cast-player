import { describe, expect, it } from 'vitest';
import { decls } from '@/test/cssDecl';

describe('a focused rail card sits flush at the 40 px row start (TvCardViewHolder.kt:381-388)', () => {
	it('adds no scroll margin on top of the rail scroll padding', () => {
		expect(decls('styles/tv-safe.css', '.rail-track > [data-focusable]:focus-visible')['scroll-margin-inline']).toBeUndefined();
	});

	it('keeps the 40 px scroll padding the card snaps to', () => {
		expect(decls('components/rails/HorizontalRail.vue', '.rail-track')['scroll-padding-inline']).toBe('40px');
	});
});
