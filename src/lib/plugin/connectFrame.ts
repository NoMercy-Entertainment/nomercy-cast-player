/**
 * One item of the shared queue, as the music hub sends it.
 *
 * The three plugin fields are absent on a server that predates them, which is
 * why they are optional: a device that demanded them played nothing at all
 * against a server that had not been updated yet.
 */
export interface ConnectItem {
	id: string;
	name: string;
	plugin_id?: string | null;
	proxy_url?: string | null;
	live?: boolean;
}

/** The answers that mean this account may play a plugin's media. */
const ALLOWED = new Set<string>(['owned', 'shared']);

/**
 * Whether this account may play an item belonging to a plugin.
 *
 * Absent is server media, which every device in the session may play. The
 * receiver keeps the same words as the phone and the browser so one device
 * cannot decide differently about the same queue.
 */
export function mayPlay(pluginId: string | null | undefined, access: Record<string, string>): boolean {
	return !pluginId || ALLOWED.has(access[pluginId] ?? '');
}

export function playableItems<T extends ConnectItem>(
	items: T[],
	access: Record<string, string>,
): T[] {
	return items.filter(item => mayPlay(item.plugin_id, access));
}
