import { afterEach, describe, expect, it } from 'vitest';
import { mountPlaybackOSD } from './PlaybackOSD';

describe('playbackOSD', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	// `.panel` is the full-screen dimmed modal layer; on the OSD it covered the playing video.
	it('is a lower band, not the full-screen panel layer', () => {
		const handle = mountPlaybackOSD({
			parent: document.body,
			title: 'Expert',
			getCurrentTime: () => 0,
			getDuration: () => 1442,
		});
		const root = document.querySelector('.playback-osd');

		expect(root).not.toBeNull();
		expect(root!.classList.contains('panel')).toBe(false);
		expect(root!.querySelector('.osd-title')?.textContent).toBe('Expert');
		handle.dispose();
	});
});
