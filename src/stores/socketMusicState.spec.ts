import { describe, expect, it } from 'vitest';

import type { MusicPlayerStateMsg } from '@/lib/signalr/events';

describe('music state from the server', () => {
	it('keeps the track length, so the passive player shows the length and fills the bar (MusicPlayerState.cs:59-60)', async () => {
		const { bindMusicPlayerState } = await import('./socketStore');
		const { playbackStore } = await import('./playbackStore');
		const handlers: Record<string, (payload?: MusicPlayerStateMsg) => void> = {};
		const hub = {
			on: (name: string, cb: (payload?: MusicPlayerStateMsg) => void) => {
				handlers[name] = cb;
			},
		};

		bindMusicPlayerState(hub as never);

		handlers.MusicPlayerState?.({
			events: [{
				type: 'PlayerStateChanged',
				source: 'server',
				event: {
					event_id: 1,
					state: {
						is_playing: false,
						item: { id: 'track-1', name: 'Example track' },
						progress_ms: 318_000,
						duration_ms: 318_000,
					},
				},
			}],
		});

		expect(playbackStore.music.track.value?.duration_ms).toBe(318_000);
	});
});
