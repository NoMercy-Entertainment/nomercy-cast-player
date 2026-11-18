import { afterEach, describe, expect, it } from 'vitest';

import { buildImageUrl, contrastRatio, isGrayscalePalette, pickLogoOutlineHex } from './urls';
import { authStore } from '@/stores/authStore';

const SERVER = 'https://00000000-0000-4000-8000-000000000001.example.test:7626';

describe('buildImageUrl', () => {
	afterEach(() => {
		authStore.serverUrl.value = null;
	});

	// devQ / cast#70: every music cover was sent to TMDB and broke.
	it('serves a path under /images/ from the media server, like app-web (imageUrl.ts:27)', () => {
		authStore.serverUrl.value = `${SERVER}/`;

		expect(buildImageUrl('/images/music/made-up-cover.jpg')).toBe(`${SERVER}/images/music/made-up-cover.jpg`);
	});

	it('still sends a TMDB path to TMDB (positive control)', () => {
		authStore.serverUrl.value = SERVER;

		expect(buildImageUrl('/abc123.jpg', { width: 300 })).toBe('https://image.tmdb.org/t/p/w300/abc123.jpg');
	});

	it('keeps an absolute URL as it is', () => {
		expect(buildImageUrl('https://example.test/a.jpg')).toBe('https://example.test/a.jpg');
	});

	it('gives nothing for a server path while no server is known', () => {
		expect(buildImageUrl('/images/music/made-up-cover.jpg')).toBeNull();
	});
});

// LogoOutlineTest.kt: the same six cases, so KMP and the receiver outline a logo alike.
describe('pickLogoOutlineHex', () => {
	it('outlines a colorless logo with the selected theme', () => {
		const outline = pickLogoOutlineHex({ dominant: '#FFFFFF' }, '#FFFFFF', '#6E56CF');

		expect(outline).toBe('#6E56CF');
		expect(contrastRatio('#FFFFFF', outline)).toBeGreaterThanOrEqual(3);
	});

	it('moves a dark theme away from a black logo', () => {
		const outline = pickLogoOutlineHex({ dominant: '#000000' }, '#222222', '#222222');

		expect(contrastRatio('#000000', outline)).toBeGreaterThanOrEqual(3);
		expect(outline).not.toBe('#222222');
	});

	it('moves a light theme away from a white logo', () => {
		const outline = pickLogoOutlineHex({ dominant: '#FFFFFF' }, '#FFFFFF', '#F5D90A');

		expect(contrastRatio('#FFFFFF', outline)).toBeGreaterThanOrEqual(3);
		expect(outline).not.toBe('#F5D90A');
	});

	it('keeps a contrasting backdrop color round a colored logo', () => {
		expect(pickLogoOutlineHex({ dominant: '#F4B942' }, '#224466', '#6E56CF')).toBe('#224466');
	});

	it('uses the selected theme when the logo has no palette', () => {
		expect(pickLogoOutlineHex(null, '#FFFFFF', '#6E56CF')).toBe('#6E56CF');
	});

	it('adjusts an outline that matches the logo\'s own color', () => {
		const outline = pickLogoOutlineHex({ dominant: '#3E63DD' }, '#3E63DD', '#6E56CF');

		expect(contrastRatio('#3E63DD', outline)).toBeGreaterThanOrEqual(3);
	});

	it('treats a palette without real chroma as grayscale', () => {
		expect(isGrayscalePalette({ dominant: '#808080', primary: '#7F7F82' })).toBe(true);
		expect(isGrayscalePalette({ dominant: '#3E63DD' })).toBe(false);
		expect(isGrayscalePalette(null)).toBe(false);
	});
});
