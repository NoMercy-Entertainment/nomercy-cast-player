import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AppLogoSquare from './AppLogoSquare.vue';

// A var() in an SVG presentation attribute is never resolved, so the stops fell back to black and the
// back triangle and bar drew as a ghost. IcAppLogoSquare.kt:35-55 fills that path with the primary brush.
describe('the logo back shape takes the primary color (IcAppLogoSquare.kt:35-55)', () => {
	it('sets the primary stops through style, not a presentation attribute', () => {
		const stops = mount(AppLogoSquare).findAll('#logo-back stop');

		expect(stops).toHaveLength(2);

		for (const stop of stops) {
			expect(stop.attributes('stop-color') ?? '').not.toContain('var(');
			expect(stop.attributes('style')?.replace(/\s/g, '')).toContain('stop-color:var(--color-primary)');
		}
	});
});
