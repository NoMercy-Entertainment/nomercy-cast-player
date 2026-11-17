import { describe, expect, it } from 'vitest';
import { hasContent } from './hasContent';
import type { Component } from './types';

const make = (component: string, props: unknown) => ({ id: 'x', component, props }) as unknown as Component;

// HasContent.kt:10-17 and NMComponents.kt:53-62.
describe('hasContent matches the native dispatcher', () => {
	it.each(['NMCarousel', 'NMGrid', 'NMList', 'NMContainer', 'NMLolomo'])('drops an empty %s', (name) => {
		expect(hasContent(make(name, { id: 'a', items: [] }))).toBe(false);
	});

	it.each(['NMCarousel', 'NMGrid', 'NMList', 'NMContainer', 'NMLolomo'])('keeps a %s with items', (name) => {
		expect(hasContent(make(name, { id: 'a', items: [{ id: 'b' }] }))).toBe(true);
	});

	it('drops an NMHomeCard with no data', () => {
		expect(hasContent(make('NMHomeCard', { id: 'a' }))).toBe(false);
		expect(hasContent(make('NMHomeCard', { data: { id: 'a' } }))).toBe(true);
	});

	it('drops a component the receiver cannot draw', () => {
		expect(hasContent(make('NMMadeUp', { id: 'a' }))).toBe(false);
	});

	it('keeps a card', () => {
		expect(hasContent(make('NMCard', { id: 'a' }))).toBe(true);
	});
});
