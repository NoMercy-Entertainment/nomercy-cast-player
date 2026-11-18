import { describe, expect, it } from 'vitest';
import { starNoiseTile } from '@/lib/starNoise';

// PosterBackground.kt:216-260: the 256 px tile of cool-white stars the search page lays over its background.
describe('the star tile follows the native noise math', () => {
	const tile = starNoiseTile(256);

	it('is 256 by 256 RGBA', () => {
		expect(tile.length).toBe(256 * 256 * 4);
	});

	it('draws sparse stars: a few lit pixels, the rest transparent (positive control: some exist)', () => {
		let lit = 0;

		for (let i = 3; i < tile.length; i += 4) {
			if (tile[i]! > 0) {
				lit++;
			}
		}

		expect(lit).toBeGreaterThan(0);
		expect(lit).toBeLessThan(256 * 256 * 0.02);
	});

	it('tints every lit pixel cool white 0.85, 0.90, 1.0', () => {
		for (let i = 0; i < tile.length; i += 4) {
			if (tile[i + 3]! > 0) {
				expect([tile[i], tile[i + 1], tile[i + 2]]).toEqual([216, 229, 255]);
			}
		}
	});
});
