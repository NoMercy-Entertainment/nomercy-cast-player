import { describe, expect, it } from 'vitest';

import type { CastNavEntry } from './slots';

import { pluginFixtures } from './fixtures.generated';
import { entriesForSlot, isRenderable } from './slots';

const entries: CastNavEntry[] = pluginFixtures.fixtures.map(fixture => fixture.entry);

/**
 * The one fixture set every client renders, on the receiver.
 *
 * The receiver draws a subset on purpose: a television has no dashboard and no
 * settings page. These pin which half is deliberate, so a slot that stops
 * drawing here fails rather than quietly vanishing from the living room.
 */
describe('the shared plugin fixtures', () => {
	// Named rather than counted. A slot dropped from the receiver by accident
	// moves into the "draws nothing" half and would pass a test that only
	// asked whether each half behaves, so the halves are pinned here.
	it('draws exactly the slots a television has a place for', () => {
		const drawn = pluginFixtures.fixtures
			.filter(fixture => isRenderable(fixture.kind, fixture.slot))
			.map(fixture => `${fixture.kind}/${fixture.slot}`)
			.sort();

		expect(drawn).toEqual([
			'library/home-row',
			'music/home-row',
			'music/player-panel',
			'video/channel-strip',
			'video/guide',
			'video/home-row',
			'video/live',
			'video/player-panel',
		]);
	});

	it('draws every slot the receiver claims to render', () => {
		const renderable = pluginFixtures.fixtures.filter(fixture =>
			isRenderable(fixture.kind, fixture.slot),
		);

		expect(renderable.length).toBeGreaterThan(0);

		for (const fixture of renderable) {
			const drawn = entriesForSlot(entries, fixture.kind, fixture.slot);

			expect(drawn, `${fixture.kind}/${fixture.slot}`).toHaveLength(1);
			expect(drawn[0].route).toBe(fixture.entry.route);
		}
	});

	// A navigation button or a settings section has nowhere to go on a screen
	// with no pointer and no keyboard. Drawing it anyway puts a control there
	// that nobody can reach.
	it('draws nothing for a slot it does not claim', () => {
		const rest = pluginFixtures.fixtures.filter(
			fixture => !isRenderable(fixture.kind, fixture.slot),
		);

		expect(rest.length).toBeGreaterThan(0);

		for (const fixture of rest)
			expect(entriesForSlot(entries, fixture.kind, fixture.slot)).toHaveLength(0);
	});

	// The renderable list is written here rather than generated, so a slot
	// dropped from the contract would leave a pair naming a slot that no longer
	// exists and a screen reserving space for nothing.
	it('claims no slot the contract does not declare', () => {
		const declared = new Set(
			pluginFixtures.fixtures.map(fixture => `${fixture.kind}/${fixture.slot}`),
		);

		for (const fixture of pluginFixtures.fixtures) {
			if (isRenderable(fixture.kind, fixture.slot))
				expect(declared.has(`${fixture.kind}/${fixture.slot}`)).toBe(true);
		}
	});

	it('answers every drawn placement with components the receiver renders', () => {
		for (const fixture of pluginFixtures.fixtures) {
			if (!isRenderable(fixture.kind, fixture.slot))
				continue;

			expect(fixture.view.components.length, `${fixture.kind}/${fixture.slot}`).toBeGreaterThan(0);

			for (const component of fixture.view.components)
				expect(component.component).toMatch(/^NM[A-Z]/);
		}
	});
});
