import { afterEach, describe, expect, it } from 'vitest';

import { buildImageUrl } from './urls';
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
