import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import HeroRailsView from '@/views/HeroRailsView.vue';
import { nextTick } from 'vue';
import { decls } from '../cssDecl';
import { focusStore } from '@/stores/focusStore';
import { focusedCardStore } from '@/stores/focusedCardStore';
import { pickPaletteColor } from '@/lib/images/urls';
import type { Component } from '@/server-components/types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

Element.prototype.scrollIntoView = vi.fn();

function card(id: string): Component {
	return {
		id,
		component: 'NMCard',
		props: { id, data: {
			id,
			title: id,
			link: `/movie/${id}`,
			poster: '/made-up.jpg',
		} },
	} as unknown as Component;
}

function rail(id: string): Component {
	return {
		id,
		component: 'NMCarousel',
		props: {
			id,
			title: id,
			more_link: `/genres/${id}`,
			items: [card(`${id}-1`), card(`${id}-2`)],
		},
	} as unknown as Component;
}

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	document.body.innerHTML = '';
});

async function home(): Promise<ReturnType<typeof mount>> {
	const host = document.createElement('div');

	document.body.appendChild(host);

	wrapper = mount(HeroRailsView, {
		attachTo: host,
		props: {
			restorationKey: 'home-focus-test',
			data: [rail('aa'), rail('bb')],
			isLoading: false,
			refetch: vi.fn(),
			errorContext: 'x',
			emptyMessage: 'x',
		},
	});

	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();

	return wrapper;
}

function press(dir: 'up' | 'down' | 'left' | 'right'): void {
	focusStore.activeGroup()?.handleKey(dir);
}

describe('home D-pad rows (TvCardViewHolder.kt:405-421, TvHomeAdapter.kt:540-561)', () => {
	it('down from a card goes to the first card of the next row, not to this row\'s Show All', async () => {
		await home();
		(document.querySelector('[data-rail-id="aa"] article') as HTMLElement).focus();
		press('down');

		expect(document.activeElement?.closest('[data-rail-id]')?.getAttribute('data-rail-id')).toBe('bb');
		expect(document.activeElement?.classList.contains('show-all')).toBe(false);
	});

	it('down from the last row stays on the card', async () => {
		await home();
		const first = document.querySelector('[data-rail-id="bb"] article') as HTMLElement;

		first.focus();
		press('down');

		expect(document.activeElement).toBe(first);
	});

	it('right past the last card reaches Show All, the last card of the row', async () => {
		await home();
		const cards = document.querySelectorAll('[data-rail-id="aa"] article');

		(cards[1] as HTMLElement).focus();
		press('right');

		expect(document.activeElement?.classList.contains('show-all')).toBe(true);
	});
});

describe('hero follows focus at the native pace (HeroSelectionTiming.kt:27-33)', () => {
	it('updates 250 ms after a horizontal move and 500 ms after a vertical one', async () => {
		vi.useFakeTimers();
		focusedCardStore.seed(null);
		focusedCardStore.setNavDirection('horizontal');
		focusedCardStore.setActive({ id: 'h', title: 'Horizontal' });
		await nextTick();
		vi.advanceTimersByTime(250);

		expect(focusedCardStore.debouncedCard.value?.id).toBe('h');

		// The first change holds the hero for 1400 ms (HeroSelectionTiming.kt:33), so wait it out.
		vi.advanceTimersByTime(1400);
		focusedCardStore.setNavDirection('vertical');
		focusedCardStore.setActive({ id: 'v', title: 'Vertical' });
		await nextTick();
		vi.advanceTimersByTime(500);

		expect(focusedCardStore.debouncedCard.value?.id).toBe('v');
		vi.useRealTimers();
	});
});

describe('card focus ring is a 2 dp white inner stroke (TvCardViewHolder.kt:68-72)', () => {
	it('the NMCard draws it inside the poster, where contain: paint cannot clip it', () => {
		expect(decls('server-components/NMCard.vue', '.card:focus-visible .poster::after').border).toBe('2px solid var(--cast-white)');
		expect(decls('server-components/NMCard.vue', '.card:focus-visible .poster')['box-shadow']).toBe('none');
	});

	it('the Show All card rings inside as well', () => {
		expect(decls('server-components/NMCarousel.vue', '.show-all:focus-visible')['box-shadow']).toBe('inset 0 0 0 1px var(--cast-white)');
	});
});

describe('accent color picks like pickPaletteHex (PaletteColors.kt:60-84)', () => {
	it('takes the dominant swatch first, skipping white and black', () => {
		expect(pickPaletteColor({
			dominant: '#FFFFFF',
			primary: '#6E3C28',
			darkVibrant: '#0000FF',
		})).toBe('#6E3C28');
	});

	it('rescales a swatch above the 120 brightness ceiling to 119', () => {
		expect(pickPaletteColor({ dominant: '#C8B478' })).toBe('#857850');
	});

	it('rescales a swatch below the 40 brightness floor to 41', () => {
		expect(pickPaletteColor({ dominant: '#28201A' })).toBe('#322820');
	});

	it('gives nothing when every swatch is white or black', () => {
		expect(pickPaletteColor({ dominant: '#000000', primary: '#FFFFFF' })).toBe('');
	});
});
