import type { PluginFrameItem, PluginMediaRef } from './mediaRef';

import { toFrameItem } from './mediaRef';

/** What either engine has to offer for a plugin's media to reach it. */
export interface PluginPlayEngine {
	play: () => void;
	loadTrack?: (data: unknown) => void;
	loadPlaylist?: (playlist: unknown, item?: unknown) => void;
}

export interface PluginPlayEngines {
	music: () => PluginPlayEngine | null;
	video: () => PluginPlayEngine | null;
}

export type PluginPlayOutcome = 'music' | 'video' | 'refused' | 'unavailable';

/**
 * The receiver's own engines, never a second player drawn by the card.
 *
 * A card that played its own stream got a small element with no artwork, no
 * remote handling and no transport, on a screen the viewer is sitting five
 * metres from.
 */
export function playPluginMedia(
	media: PluginMediaRef,
	engines: PluginPlayEngines,
): PluginPlayOutcome {
	const item: PluginFrameItem | null = toFrameItem(media);

	if (!item)
		return 'refused';

	if (media.kind === 'audio') {
		const engine: PluginPlayEngine | null = engines.music();

		if (!engine?.loadTrack)
			return 'unavailable';

		engine.loadTrack(item);
		engine.play();

		return 'music';
	}

	const engine: PluginPlayEngine | null = engines.video();

	if (!engine?.loadPlaylist)
		return 'unavailable';

	engine.loadPlaylist([item], item);
	engine.play();

	return 'video';
}
