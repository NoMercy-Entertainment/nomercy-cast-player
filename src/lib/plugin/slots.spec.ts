import { describe, expect, it } from 'vitest';

import type { CastNavEntry } from './slots';

import { entriesForSlot, isRenderable, surfaceRefusal } from './slots';

function entry(section: string, slot: string, surfaces: string[]): CastNavEntry {
	return {
		section,
		label: 'Stations',
		icon: null,
		route: '/',
		slot,
		access: 'shared',
		surfaces,
	};
}

describe('what the receiver draws', () => {
	it('draws a home row a plugin marked for cast', () => {
		expect(entriesForSlot([entry('music', 'home-row', ['cast'])], 'music', 'home-row'))
			.toHaveLength(1);
	});

	it('draws an entry that names no surface, because that means every surface', () => {
		expect(entriesForSlot([entry('music', 'home-row', [])], 'music', 'home-row'))
			.toHaveLength(1);
	});

	it('does not draw an entry marked for web only', () => {
		expect(entriesForSlot([entry('music', 'home-row', ['web'])], 'music', 'home-row'))
			.toHaveLength(0);
	});

	it('does not draw an entry placed in another slot of the same area', () => {
		expect(entriesForSlot([entry('music', 'player-panel', ['cast'])], 'music', 'home-row'))
			.toHaveLength(0);
	});

	it('does not draw an entry from another area', () => {
		expect(entriesForSlot([entry('video', 'home-row', ['cast'])], 'music', 'home-row'))
			.toHaveLength(0);
	});

	it('says why it did not draw it', () => {
		const refusal = surfaceRefusal('Internet Radio', ['web']);

		expect(refusal.code).toBe('PLUGIN_CAST_SURFACE_UNSUPPORTED');
		expect(refusal.severity).toBe('degraded');
		expect(refusal.fix).toContain('cast');
		expect(refusal.why).toContain('web');
	});

	it('refuses a slot the receiver has no place for', () => {
		expect(isRenderable('settings', 'section')).toBe(false);
		expect(isRenderable('dashboard', 'card')).toBe(false);
		expect(isRenderable('music', 'artist-tab')).toBe(false);
	});

	it('draws the places a receiver really has', () => {
		expect(isRenderable('music', 'home-row')).toBe(true);
		expect(isRenderable('video', 'live')).toBe(true);
		expect(isRenderable('video', 'channel-strip')).toBe(true);
		expect(isRenderable('library', 'home-row')).toBe(true);
	});

	it('draws nothing at all for a slot it cannot place, whatever was sent', () => {
		expect(entriesForSlot([entry('settings', 'section', ['cast'])], 'settings', 'section'))
			.toHaveLength(0);
	});
});
