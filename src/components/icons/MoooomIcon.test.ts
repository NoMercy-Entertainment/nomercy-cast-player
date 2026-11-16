import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MoooomIcon from './MoooomIcon.vue';

const FILM_PATH_START = 'M7 3c-.93 0-1.395 0-1.776.102a3 3 0 0 0-2.122 2.122C3 5.605 3 6.07 3 7';

describe('moooomIcon', () => {
	it('draws the sprite body of a known name on first render', () => {
		const svg = mount(MoooomIcon, { props: { icon: 'film' } }).get('svg').element;

		expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
		expect(svg.querySelector('path')?.getAttribute('d')?.startsWith(FILM_PATH_START)).toBe(true);
	});

	it('keeps the fill and stroke hooks of the sprite', () => {
		const svg = mount(MoooomIcon, { props: { icon: 'film' } }).get('svg').element;

		expect(svg.getAttribute('fill')).toBe('var(--fill-color, none)');
		expect(svg.querySelector('path')?.getAttribute('stroke')).toBe('currentColor');
	});

	it('keeps the caller class and hides the icon from assistive tech', () => {
		const svg = mount(MoooomIcon, { props: { icon: 'film' }, attrs: { class: 'empty-icon' } }).get('svg').element;

		expect(svg.classList.contains('empty-icon')).toBe(true);
		expect(svg.getAttribute('aria-hidden')).toBe('true');
		expect(svg.getAttribute('data-icon')).toBe('film');
	});

	it('renders an empty svg for a name nobody knows', () => {
		const svg = mount(MoooomIcon, { props: { icon: 'noSuchIconAnywhere' } }).get('svg').element;

		expect(svg.children.length).toBe(0);
	});
});
