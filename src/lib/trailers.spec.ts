import { describe, expect, it } from 'vitest';
import { toLookup } from './trailers';

// The subtitle label rule reads the file name (SubtitleLabelFormatter.formatLabel(filename, languageCode)).
describe('the trailer lookup keeps each subtitle file name', () => {
	it('carries file, lang and url of every subtitle', () => {
		const lookup = toLookup({
			success: true,
			data: {
				videoId: 'placeholder-video',
				cached: true,
				downloadUrl: 'https://example.invalid/trailer.mp4',
				subtitles: [{ file: 'trailer.en.sdh.srt', lang: 'en', url: 'https://example.invalid/trailer.en.vtt' }],
			},
		});

		expect(lookup.state === 'available' && lookup.trailer.subtitles).toEqual([
			{ file: 'trailer.en.sdh.srt', language: 'en', url: 'https://example.invalid/trailer.en.vtt' },
		]);
	});
});
