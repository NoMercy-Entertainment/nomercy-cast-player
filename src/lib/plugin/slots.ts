import type { PluginRefusal } from './refusal';

import { PluginKind, PluginSlot } from '@/types/pluginVocabulary';

export interface CastNavEntry {
	section: string;
	label: string;
	icon?: string | null;
	route: string;
	slot?: string;
	access?: string;
	surfaces?: string[];
}

/**
 * A receiver has a home wall and a player, and nothing else.
 *
 * There is no settings screen, no dashboard and no navigation drawer here, so
 * a placement asking for one of those has nowhere to go. Refused rather than
 * dropped without a word: an author whose row never appeared had nothing to
 * read and nothing to change.
 */
const RENDERABLE: Array<[string, string]> = [
	[PluginKind.Music, PluginSlot.HomeRow],
	[PluginKind.Music, PluginSlot.PlayerPanel],
	[PluginKind.Video, PluginSlot.HomeRow],
	[PluginKind.Video, PluginSlot.PlayerPanel],
	[PluginKind.Video, PluginSlot.Live],
	[PluginKind.Video, PluginSlot.Guide],
	[PluginKind.Video, PluginSlot.ChannelStrip],
	[PluginKind.Library, PluginSlot.HomeRow],
];

export function isRenderable(kind: string, slot: string): boolean {
	return RENDERABLE.some(([one, two]) => one === kind && two === slot);
}

export function entriesForSlot(
	all: CastNavEntry[],
	kind: string,
	slot: string,
): CastNavEntry[] {
	if (!isRenderable(kind, slot))
		return [];

	return all.filter((entry) => {
		if (entry.section !== kind || (entry.slot ?? PluginSlot.Nav) !== slot)
			return false;

		// Naming no surface means every surface. A plugin written before the
		// receiver existed says nothing, and dropping those would have hidden
		// every placement already shipped.
		const surfaces: string[] = entry.surfaces ?? [];

		return surfaces.length === 0 || surfaces.includes('cast');
	});
}

export function surfaceRefusal(plugin: string, surfaces: string[]): PluginRefusal {
	return {
		code: 'PLUGIN_CAST_SURFACE_UNSUPPORTED',
		plugin,
		what: `The receiver did not draw a placement from ${plugin}.`,
		why: `The placement names the surfaces ${surfaces.join(', ')} and this device is a cast receiver.`,
		fix: 'Add cast to the surfaces the placement declares, and check the view renders at ten feet. Docs: /nomercy-plugins/capabilities/ui-mount',
		severity: 'degraded',
	};
}
