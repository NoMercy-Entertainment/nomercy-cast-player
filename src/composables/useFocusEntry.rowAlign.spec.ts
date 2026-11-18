import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { useFocusEntry } from '@/composables/useFocusEntry';
import type { FocusEntry } from '@/composables/useFocusEntry';

// The TV's Chrome 92 ignores scroll-margin and scroll-padding in scrollIntoView, so a row landed
// 34 px high (its title under the hero) and row 0 never scrolled back to 0. RowTopAlignLayoutManager
// puts the row top at the list's top padding: the list scroll is set explicitly.

function rect(top: number, height: number): DOMRect {
	return {
		top,
		bottom: top + height,
		left: 0,
		right: 960,
		width: 960,
		height,
		x: 0,
		y: top,
		toJSON: () => ({}),
	};
}

function mountCard() {
	const port = document.createElement('div');

	port.className = 'nm-hero-rails';
	port.style.scrollPaddingTop = '8px';
	port.scrollTop = 0;
	document.body.appendChild(port);

	const row = document.createElement('section');

	row.className = 'rail-section';
	port.appendChild(row);

	const host = document.createElement('div');

	// The row's own horizontal scroller (HorizontalRail.vue: .rail-track, padding 40 px).
	host.className = 'rail-track';
	host.style.paddingLeft = '40px';
	host.getBoundingClientRect = () => rect(734, 180);
	row.appendChild(host);

	// The list's viewport starts at 254; row 2 sits 450 px down the list, its card 30 px under its top.
	port.getBoundingClientRect = () => rect(254, 286);
	row.getBoundingClientRect = () => rect(704, 220);

	let entry!: FocusEntry;

	const Card = defineComponent({
		setup() {
			const el = ref<HTMLElement | null>(null);

			entry = useFocusEntry({
				key: 'card',
				el,
				group: { type: 'horizontal', register: () => () => undefined },
			});

			return () => h('button', { ref: el, 'data-focusable': '' });
		},
	});

	mount(Card, { attachTo: host });

	// The card sits 300 px from the track's left edge.
	(host.querySelector('button') as HTMLElement).getBoundingClientRect = () => ({
		...rect(734, 180),
		left: 300,
		x: 300,
	});

	return {
		entry,
		port,
		track: host,
	} as const satisfies {
		entry: FocusEntry;
		port: HTMLElement;
		track: HTMLElement;
	};
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('a focused card puts its row top at the list top padding (RowTopAlignLayoutManager)', () => {
	it('scrolls the list itself, not through scroll-margin', () => {
		Element.prototype.scrollIntoView = vi.fn();
		const { entry, port } = mountCard();
		const scrollTo = vi.fn();

		port.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];

		entry.focus();

		// 704 - 254 - 8 = 442: the row top lands 8 px under the list top on every engine.
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 442 }));
	});

	// On the TV, scrollIntoView's block 'nearest' scrolled the list too (card bottom at the screen bottom)
	// and won over the list scroll, so the row above stayed half visible under the hero.
	// TvRowFocus.kt:136-141 moves the list by the row top alone. The browser's own focus scroll put a
	// row's card at the list bottom (card top 364) or top (262) before the row align ran.
	it('never lets the browser scroll the list on focus, so the row align is the only scroll', () => {
		Element.prototype.scrollIntoView = vi.fn();
		const { entry, port } = mountCard();
		const focus = vi.spyOn(HTMLElement.prototype, 'focus');

		port.scrollTo = vi.fn() as unknown as HTMLElement['scrollTo'];

		entry.focus();

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		focus.mockRestore();
	});

	it('scrolls the row track to the card and never calls scrollIntoView, so nothing fights the list scroll', () => {
		const into = vi.fn();

		Element.prototype.scrollIntoView = into;
		const { entry, port, track } = mountCard();
		const trackTo = vi.fn();

		port.scrollTo = vi.fn() as unknown as HTMLElement['scrollTo'];
		track.scrollTo = trackTo as unknown as HTMLElement['scrollTo'];

		entry.focus();

		expect(into).not.toHaveBeenCalled();
		// 300 - 0 - 40: the card's left edge lands on the track's 40 px start padding.
		expect(trackTo).toHaveBeenCalledWith(expect.objectContaining({ left: 260 }));
	});
});

// TvRowFocus.kt:136-141: the season chip is the title of its row, so focus puts that row's top at the
// list top padding like any row (the chip stayed at y=468 on the receiver, KMP moves it up).
describe('the season chip aligns its row top like a rail card', () => {
	it('scrolls the info list so the seasons row top sits at the list top padding', () => {
		const port = document.createElement('div');

		port.className = 'info-list';
		port.style.scrollPaddingTop = '8px';
		document.body.appendChild(port);

		const row = document.createElement('section');

		row.className = 'info-seasons';
		port.appendChild(row);
		port.getBoundingClientRect = () => rect(264, 276);
		row.getBoundingClientRect = () => rect(460, 220);

		let entry!: FocusEntry;

		const Chip = defineComponent({
			setup() {
				const el = ref<HTMLElement | null>(null);

				entry = useFocusEntry({
					key: 'season-chip',
					el,
					alignRow: true,
					group: { type: 'vertical', register: () => () => undefined },
				});

				return () => h('button', { ref: el, 'data-focusable': '' });
			},
		});

		mount(Chip, { attachTo: row });
		Element.prototype.scrollIntoView = vi.fn();

		const scrollTo = vi.fn();

		port.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];

		entry.focus();

		// 460 - 264 - 8 = 188
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 188 }));
	});
});
