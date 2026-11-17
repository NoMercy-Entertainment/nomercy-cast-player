import { keyOf } from '@/players/video/plugins/tv-ui/keys';

export interface MusicTransport {
	play: () => void | Promise<void>;
	pause: () => void;
	next: () => void;
	previous: () => void;
}

/**
 * A remote media key drives music anywhere in the app, as KMP's media session does.
 * The video player takes its keys first in the capture phase and marks them handled.
 */
export function handleMusicMediaKey(
	event: KeyboardEvent,
	engine: MusicTransport | null,
	playing: boolean,
): boolean {
	if (event.defaultPrevented || !engine)
		return false;

	switch (keyOf(event)) {
		case 'playPause':
			void (playing
				? engine.pause()
				: engine.play());

			break;
		case 'play':
			void engine.play();
			break;
		case 'pause':
		case 'stop':
			void engine.pause();
			break;
		case 'next':
			void engine.next();
			break;
		case 'previous':
			void engine.previous();
			break;
		default:
			return false;
	}

	event.preventDefault();

	return true;
}
