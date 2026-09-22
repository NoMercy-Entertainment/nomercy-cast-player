import { describe, expect, it } from 'vitest';

import resolverSource from './Resolver.vue?raw';
import { sinkComponents } from '@/lib/plugin/sinkComponents.generated';

/**
 * What the receiver draws out of everything a plugin can send.
 *
 * A television is not a browser, and the receiver implements a subset on
 * purpose. The point of this file is that the subset is written down: a
 * component that falls out of the registry lands in the second list instead of
 * drawing nothing in the living room while every other client looks fine.
 *
 * The registry is read out of the resolver rather than restated here. Restated,
 * it agrees with itself and says nothing about what the resolver does.
 */
function registry(): string[] {
	const names = resolverSource.matchAll(/^\t(NM[A-Za-z]+):/gm);

	return [...names].map(match => match[1]).sort();
}

/**
 * Named one by one rather than counted. A component leaving the receiver has
 * to be a line somebody deleted here, not a number that moved.
 */
const NOT_ON_A_TELEVISION: readonly string[] = [
	'NMAccordion',
	'NMAlert',
	'NMAvatar',
	'NMBadge',
	'NMBadgeGroup',
	'NMBreadcrumb',
	'NMButton',
	'NMButtonGroup',
	'NMChat',
	'NMCheckbox',
	'NMCheckboxGroup',
	'NMColorPicker',
	'NMCombobox',
	'NMCommandPalette',
	'NMContentFooter',
	'NMContentHeader',
	'NMDatePicker',
	'NMDivider',
	'NMDrawer',
	'NMDropdown',
	'NMEmptyState',
	'NMFileUpload',
	'NMFormLabel',
	'NMHelper',
	// The receiver ships no icon set. Drawing one by hand would be a second
	// icon vocabulary next to the design system's, which is the one thing the
	// generated components exist to prevent.
	'NMIcon',
	'NMImage',
	'NMInput',
	'NMLink',
	'NMMetrics',
	'NMModal',
	'NMNavigation',
	'NMPagination',
	'NMPopover',
	'NMProgress',
	'NMRadio',
	'NMRadioGroup',
	'NMRating',
	'NMSearchInput',
	'NMSegmented',
	'NMSelect',
	'NMSkeleton',
	'NMSlider',
	'NMSpinner',
	'NMStepIndicator',
	'NMStepper',
	'NMTable',
	'NMTabs',
	'NMTag',
	'NMTextarea',
	'NMToast',
	'NMToggle',
	'NMToggles',
	'NMTooltip',
	'NMTreeView',
];

describe('what the receiver draws', () => {
	it('draws or names every component the kitchen sink sends', () => {
		const drawn = new Set(registry());
		const missing = sinkComponents.filter(
			name => !drawn.has(name) && !NOT_ON_A_TELEVISION.includes(name),
		);

		expect(missing, 'a component the sink sends that this receiver neither draws nor lists').toEqual([]);
	});

	// The second list is a decision, not a leftover. A component that gains a
	// renderer has to leave it, or the list quietly claims the receiver cannot
	// draw something it draws.
	it('lists nothing it actually draws', () => {
		const drawn = new Set(registry());

		expect(NOT_ON_A_TELEVISION.filter(name => drawn.has(name))).toEqual([]);
	});

	// A registry entry for a component no plugin can send is a renderer nobody
	// reaches, and it goes stale without anyone noticing.
	it('carries no renderer for a component the contract never sends', () => {
		const sent = new Set(sinkComponents);
		const sinkless = registry().filter(name => !sent.has(name));

		// The receiver's own home screen sends these; the sink is a plugin's
		// vocabulary, and the app's own screens use a few more.
		expect(sinkless).toEqual([
			'NMContainer',
			'NMGenreCard',
			'NMGrid',
			'NMHero',
			'NMHeroCard',
			'NMHomeCard',
			'NMMusicCard',
			'NMMusicHomeCard',
			'NMTopResultCard',
			'NMTrackRow',
		]);
	});
});
