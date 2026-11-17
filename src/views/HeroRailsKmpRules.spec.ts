import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import HeroRailsView from './HeroRailsView.vue';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { Component } from '@/server-components/types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

Element.prototype.scrollIntoView = vi.fn();

function card(id: string, extra: Record<string, unknown> = {}): Component {
	return {
		id,
		component: 'NMCard',
		props: { id, data: {
			id,
			title: `Title ${id}`,
			backdrop: `/${id}.jpg`,
			poster: `/${id}-p.jpg`,
			...extra,
		} },
	} as unknown as Component;
}

function carousel(id: string, items: Component[]): Component {
	return {
		id,
		component: 'NMCarousel',
		props: {
			id,
			title: id,
			items,
		},
	} as unknown as Component;
}

function lolomo(items: Component[], extra: Record<string, unknown> = {}): Component {
	return {
		id: 'home',
		component: 'NMLolomo',
		props: {
			id: 'home',
			items,
			...extra,
		},
	} as unknown as Component;
}

// One lolomo of single-card rows named r1, r2, ...
function page(cards: Component[][], extra: Record<string, unknown> = {}): Component {
	const rows = cards.map((items, index) => carousel(`r${index + 1}`, items));

	return lolomo(rows, extra);
}

async function settle(): Promise<void> {
	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();
}

function mountView(overrides: Record<string, unknown>): ReturnType<typeof mount> {
	return mount(HeroRailsView, {
		props: {
			restorationKey: `kmp-rules-${Math.random()}`,
			data: [],
			isLoading: false,
			refetch: vi.fn(),
			errorContext: 'LOAD FAILED',
			emptyMessage: 'EMPTY',
			...overrides,
		},
	});
}

describe('a failed refetch keeps the rows on screen (NMLolomo.kt:83-92)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps the rows when the error arrives while data is cached', async () => {
		const wrapper = mountView({ data: [page([[card('a')]])] });

		await settle();
		await wrapper.setProps({ error: new Error('boom') });
		await vi.advanceTimersByTimeAsync(2000);
		await settle();

		expect(wrapper.find('[data-rail-id="r1"]').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('LOAD FAILED');
	});

	it('shows the error panel only after 900 ms when there is no data', async () => {
		const wrapper = mountView({ data: undefined, error: new Error('boom') });

		await settle();
		expect(wrapper.text()).not.toContain('LOAD FAILED');

		await vi.advanceTimersByTimeAsync(900);
		await settle();
		expect(wrapper.text()).toContain('LOAD FAILED');
	});
});

describe('which top-level components the TV page draws (HasContent.kt:38-48)', () => {
	it('draws only the rails when the answer also holds a top-level NMHomeCard', async () => {
		const banner = {
			id: 'banner',
			component: 'NMHomeCard',
			props: { id: 'banner', data: {
				id: 'banner',
				title: 'Banner',
				backdrop: '/x.jpg',
			} },
		} as unknown as Component;
		const wrapper = mountView({ data: [banner, page([[card('a')]])] });

		await settle();

		expect(wrapper.find('[data-rail-id="r1"]').exists()).toBe(true);
		expect(wrapper.find('.nm-hero-rails').element.children).toHaveLength(1);
	});
});

describe('the hero only shows for pages with carousels (NMLolomo.kt:74-75)', () => {
	it('draws no hero for a page of grid rows', async () => {
		const grid = {
			id: 'g',
			component: 'NMGrid',
			props: { id: 'g', items: [card('a'), card('b')] },
		} as unknown as Component;
		const wrapper = mountView({ data: [grid] });

		await settle();

		focusedCardStore.seed({
			id: 'a',
			title: 'A',
			backdrop: '/a.jpg',
		});

		await settle();

		expect(wrapper.find('.hero').exists()).toBe(false);
		expect(wrapper.find('.nm-hero-rails').classes()).toContain('nm-hero-rails--no-hero');
	});

	it('draws no hero when the lolomo says hero none', async () => {
		const wrapper = mountView({ data: [page([[card('a')]], { hero: 'none' })] });

		await settle();

		focusedCardStore.seed({
			id: 'a',
			title: 'A',
			backdrop: '/a.jpg',
		});

		await settle();

		expect(wrapper.find('.hero').exists()).toBe(false);
	});

	it('draws the hero for a page with carousels (positive control)', async () => {
		const wrapper = mountView({ data: [page([[card('a')]])] });

		await settle();

		expect(wrapper.find('.hero').exists()).toBe(true);
	});
});

describe('down from the nav enters the first visible row (VideoContentList.kt:87-105)', () => {
	it('focuses the row that is on screen when the page is scrolled', async () => {
		const wrapper = mount(HeroRailsView, {
			attachTo: document.body,
			props: {
				restorationKey: `kmp-nav-down-${Math.random()}`,
				data: [page([[card('a')], [card('b')]])],
				isLoading: false,
				refetch: vi.fn(),
				errorContext: 'LOAD FAILED',
				emptyMessage: 'EMPTY',
			},
		});

		await settle();
		(document.activeElement as HTMLElement | null)?.blur();

		const rect = (top: number, bottom: number): DOMRect => ({ top, bottom } as DOMRect);
		const scrollport = wrapper.get('.nm-hero-rails').element;
		const [first, second] = wrapper.findAll('.rail-section').map((s) => s.element);

		vi.spyOn(scrollport, 'getBoundingClientRect').mockReturnValue(rect(100, 540));
		vi.spyOn(first as Element, 'getBoundingClientRect').mockReturnValue(rect(-200, 60));
		vi.spyOn(second as Element, 'getBoundingClientRect').mockReturnValue(rect(110, 300));

		window.dispatchEvent(new CustomEvent('cast-receiver:nav-down'));
		await settle();

		expect(second?.contains(document.activeElement)).toBe(true);
		wrapper.unmount();
	});
});

describe('the hero re-seeds on every page change (NMLolomo.kt:194-216)', () => {
	it('shows the first card of the new page, not the last focused card of the old one', async () => {
		focusedCardStore.seed({
			id: 'old-home-card',
			title: 'Old',
			backdrop: '/old.jpg',
		});

		mountView({ data: [page([[card('first-of-library'), card('second')]])] });
		await settle();

		expect(focusedCardStore.debouncedCard.value?.id).toBe('first-of-library');
	});

	it('takes the first card of the first row even when it has no art', async () => {
		focusedCardStore.seed({
			id: 'old-home-card',
			title: 'Old',
			backdrop: '/old.jpg',
		});

		const bare = card('bare', { backdrop: undefined, poster: undefined });

		mountView({ data: [page([[bare], [card('art')]])] });
		await settle();

		expect(focusedCardStore.debouncedCard.value?.id).toBe('bare');
	});
});
