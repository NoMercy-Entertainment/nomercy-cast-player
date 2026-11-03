import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import { dispatchInitialIntent } from './navStore';

describe('navStore.dispatchInitialIntent', () => {
	it('carries a series episode and resume position into the watch route', () => {
		const push = vi.fn();
		dispatchInitialIntent({ type: 'play_video', media_type: 'tv', media_id: '42', season: 1, episode: 3, resume_at: 90 }, { push } as unknown as Router);
		expect(push).toHaveBeenCalledWith({ path: '/tv/42/watch', query: { season: '1', episode: '3', resume_at: '90' } });
	});
	it('carries the audio and subtitle the phone showed into the watch route', () => {
		const push = vi.fn();
		dispatchInitialIntent({
			type: 'play_video',
			media_type: 'tv',
			media_id: '82684',
			resume_at: 1171,
			audio_language: 'eng',
			subtitle_language: 'eng',
			subtitle_type: 'full',
			subtitle_codec: 'ass',
		}, { push } as unknown as Router);

		expect(push).toHaveBeenCalledWith({
			path: '/tv/82684/watch',
			query: { resume_at: '1171', audio: 'eng', subtitle: 'eng', subtitleType: 'full', subtitleFormat: 'ass' },
		});
	});

	it('sends no language query when the intent carries none', () => {
		const push = vi.fn();
		dispatchInitialIntent({ type: 'play_video', media_type: 'movie', media_id: '603' }, { push } as unknown as Router);

		expect(push).toHaveBeenCalledWith({ path: '/movie/603/watch', query: undefined });
	});
});
