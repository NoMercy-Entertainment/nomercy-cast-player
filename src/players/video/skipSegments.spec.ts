import { describe, expect, it } from 'vitest';
import { decideSkipAction } from './skipSegments';

describe('server skip segment decisions', () => {
	const credits = { type: 'Credits', credits_start: 80, content_end: 110 };
	it('shows next episode at credits start and waits through an epilogue', () => {
		expect(decideSkipAction(79, [credits], true)).toBe('none');
		expect(decideSkipAction(80, [credits], true)).toBe('next-button');
		expect(decideSkipAction(100, [credits], true)).toBe('next-button');
		expect(decideSkipAction(110, [credits], true)).toBe('advance');
	});
	it('never advances on OCR-only credits or absent segments', () => {
		expect(decideSkipAction(110, [{ ...credits, ocr_only: true }], true)).toBe('next-button');
		expect(decideSkipAction(110, [], true)).toBe('none');
		expect(decideSkipAction(110, [credits], false)).toBe('none');
	});
});
