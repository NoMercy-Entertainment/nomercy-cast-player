import { describe, expect, it } from 'vitest';
import { constrainGroundColor } from './theme';

// CastGroundColor.kt:14-60: lightness capped at 0.3, hue and saturation kept, a darker color unchanged.
describe('constrainGroundColor matches CastGroundColor.kt', () => {
	it('caps a white at lightness 0.3', () => {
		expect(constrainGroundColor('#ffffff')).toBe('#4d4d4d');
	});

	it('keeps the hue and saturation of a bright color', () => {
		expect(constrainGroundColor('#ff0000')).toBe('#990000');
	});

	it('returns a color at or below the limit unchanged', () => {
		expect(constrainGroundColor('#330000')).toBe('#330000');
	});
});
