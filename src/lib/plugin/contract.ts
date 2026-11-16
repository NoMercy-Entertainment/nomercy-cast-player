import type { Component } from '@/server-components/types';

import type { JsonValue } from '@/types/cast';

import type { CastNavEntry } from './slots';

/**
 * What this device is, in the words the server asks for.
 *
 * The server draws a different view per surface, so a plugin can answer a
 * ten-foot screen with rows a pointer surface would never use. A receiver that
 * asked as the browser does was served the browser's view and drew controls
 * nobody sitting on a sofa can reach.
 */
export const CAST_SURFACE = 'cast';
export const CAST_INPUT = 'pointer';

export const PLUGIN_UI_PATH = '/api/v1/plugins/ui';

export interface CastPluginDescriptor {
	id: string;
	name: string;
	access?: string;
	entries: CastNavEntry[];
}

export function viewPath(pluginId: string, route: string): string {
	const query = [
		`route=${encodeURIComponent(route)}`,
		`surface=${CAST_SURFACE}`,
		`input=${CAST_INPUT}`,
	].join('&');

	return `/api/v1/plugins/${encodeURIComponent(pluginId)}/view?${query}`;
}

interface JsonRecord { [key: string]: JsonValue }

function isRecord(value: JsonValue | undefined): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNavEntry(value: unknown): value is CastNavEntry {
	return typeof value === 'object' && value !== null;
}

function isComponentList(value: unknown): value is Component[] {
	return Array.isArray(value);
}

function unwrap(payload: JsonValue): JsonValue {
	if (isRecord(payload) && 'data' in payload)
		return payload.data ?? null;

	return payload;
}

/**
 * The plugins this server placed somewhere, as this account may see them.
 *
 * Everything unreadable is dropped rather than guessed at: one plugin sending a
 * shape this build has never met must not empty the wall for the other five.
 */
export function decodePlacements(payload: JsonValue): CastPluginDescriptor[] {
	const list = unwrap(payload);

	if (!Array.isArray(list))
		return [];

	return list.flatMap((record) => {
		if (!isRecord(record))
			return [];

		if (typeof record.id !== 'string' || record.id.length === 0)
			return [];

		const entries = Array.isArray(record.nav_entries)
			? record.nav_entries
			: [];

		return [{
			id: record.id,
			name: typeof record.name === 'string'
				? record.name
				: record.id,
			access: typeof record.access === 'string'
				? record.access
				: undefined,
			entries: entries.flatMap((entry) =>
				isNavEntry(entry)
					? [entry]
					: []),
		}];
	});
}

/**
 * The node tree one placement draws.
 *
 * The server composes a plugin's screen out of the same components it composes
 * its own screens from, so this hands the tree straight to the resolver. A
 * component this build does not know draws the unknown-component notice, which
 * is a sentence the viewer can read rather than a hole in the row.
 */
export function decodeView(payload: JsonValue): Component[] {
	const view = unwrap(payload);

	if (isComponentList(view))
		return view;

	if (isRecord(view) && isComponentList(view.components))
		return view.components;

	return [];
}
