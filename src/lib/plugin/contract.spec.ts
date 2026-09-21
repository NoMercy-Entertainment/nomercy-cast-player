import { describe, expect, it } from 'vitest';

import { decodePlacements, decodeView, viewPath } from './contract';

describe('what the receiver asks the server for', () => {
	it('asks for the cast view of a route, not the browser one', () => {
		const path = viewPath('radio', '/stations/3');

		expect(path).toContain('surface=cast');
		expect(path).toContain('input=pointer');
		expect(path).toContain(`route=${encodeURIComponent('/stations/3')}`);
	});

	it('escapes a plugin id so it cannot reach another endpoint', () => {
		expect(viewPath('a/b', '/')).toContain('plugins/a%2Fb/view');
	});

	it('reads the placements out of the envelope the server sends', () => {
		const plugins = decodePlacements({
			data: [{
				id: 'radio',
				name: 'Internet Radio',
				access: 'owned',
				nav_entries: [{ section: 'music', label: 'Stations', route: '/', slot: 'home-row' }],
			}],
		});

		expect(plugins).toHaveLength(1);
		expect(plugins[0].name).toBe('Internet Radio');
		expect(plugins[0].entries[0].route).toBe('/');
	});

	it('keeps the readable plugins when one of them is nonsense', () => {
		const plugins = decodePlacements({ data: [{ nav_entries: [] }, { id: 'radio' }] });

		expect(plugins.map(one => one.id)).toEqual(['radio']);
	});

	it('names a plugin by its id when the server sent no name', () => {
		expect(decodePlacements({ data: [{ id: 'radio' }] })[0].name).toBe('radio');
	});

	it('draws nothing rather than throwing when the answer is not a list', () => {
		expect(decodePlacements({ data: { id: 'radio' } })).toEqual([]);
		expect(decodePlacements(null)).toEqual([]);
	});

	it('reads the node tree whether it is wrapped or bare', () => {
		const wrapped = decodeView({ data: { components: [{ id: 'one', component: 'NMCarousel' }] } });
		const bare = decodeView({ data: [{ id: 'one', component: 'NMCarousel' }] });

		expect(wrapped[0].id).toBe('one');
		expect(bare[0].id).toBe('one');
	});

	it('draws nothing for a view that carries no components', () => {
		expect(decodeView({ data: { webView: 'https://example.test' } })).toEqual([]);
	});
});
