import { describe, expect, it } from 'vitest';

import { toPlaylistResponse } from './usePlaylistQuery';

// The media server's GET /api/v1/{type}/{id}/watch answers with a bare array of
// VideoPlaylistResponseDto (TvShowsController.Watch), one entry per playable episode.
const episodes = [
	{ id: 'a', title: 'Beginner', season: 1, episode: 1 },
	{ id: 'b', title: 'Challenger', season: 1, episode: 2 },
];

describe('the watch answer the media server sends', () => {
	it('turns the bare episode array into a playlist with a first item', () => {
		const response = toPlaylistResponse(episodes);

		expect(response.playlist).toHaveLength(2);
		expect(response.item).toEqual(episodes[0]);
	});

	it('keeps an answer that already has item and playlist', () => {
		const response = toPlaylistResponse({ item: episodes[1], playlist: episodes });

		expect(response.item).toEqual(episodes[1]);
		expect(response.playlist).toHaveLength(2);
	});

	it('gives an empty playlist for an empty answer', () => {
		expect(toPlaylistResponse([])).toEqual({ item: undefined, playlist: [] });
	});
});
