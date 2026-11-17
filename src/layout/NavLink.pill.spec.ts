import { describe, expect, it } from 'vitest';
import { decls } from '@/test/cssDecl';

// TvNavigationBar.kt:313-315, 366-370: pill 20 dp, ring 24 dp with a 6 dp gap, so both stay capsules on one center.
describe('the focused nav pill keeps its capsule (TvNavigationBar.kt:313-315, 366-370)', () => {
	it('keeps the 20 px radius when focused', () => {
		expect(decls('layout/NavLink.vue', '.nav-link:focus-visible')['border-radius']).toBe('20px');
	});

	it('draws the ring 6 px out with a 24 px radius, concentric with the pill', () => {
		const ring = decls('layout/NavLink.vue', '.nav-link::after');

		expect(ring.inset).toBe('-6px');
		expect(ring['border-radius']).toBe('24px');
	});
});
