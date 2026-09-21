import { describe, expect, it } from 'vitest';

import type { ConnectItem } from './connectFrame';

import { mayPlay, playableItems } from './connectFrame';

const serverItem: ConnectItem = { id: 'a', name: 'Track', plugin_id: null };
const pluginItem: ConnectItem = { id: 'b', name: 'NPO 3FM', plugin_id: 'radio', live: true };

describe('plugin media inside the Connect frame', () => {
	it('keeps server media and plugin media this account has', () => {
		expect(playableItems([serverItem, pluginItem], { radio: 'shared' }).map(one => one.id))
			.toEqual(['a', 'b']);
		expect(playableItems([pluginItem], { radio: 'owned' }).map(one => one.id)).toEqual(['b']);
	});

	it('leaves alone a plugin item this account has no access to', () => {
		expect(playableItems([serverItem, pluginItem], { radio: 'none' }).map(one => one.id))
			.toEqual(['a']);
		expect(playableItems([serverItem, pluginItem], {}).map(one => one.id)).toEqual(['a']);
	});

	it('treats a frame with no plugin fields as all server media, so an older server still plays', () => {
		expect(playableItems([{ id: 'a', name: 'Track' }], {}).map(one => one.id)).toEqual(['a']);
	});

	it('answers about one item the same way it answers about a list', () => {
		expect(mayPlay(null, {})).toBe(true);
		expect(mayPlay(undefined, {})).toBe(true);
		expect(mayPlay('radio', { radio: 'owned' })).toBe(true);
		expect(mayPlay('radio', {})).toBe(false);
	});
});
