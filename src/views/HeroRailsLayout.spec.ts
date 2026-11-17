import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import HeroRailsView from './HeroRailsView.vue';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { Component } from '@/server-components/types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

Element.prototype.scrollIntoView = vi.fn();

function source(relative: string): string {
	const file = fileURLToPath(new URL(relative, import.meta.url));

	return readFileSync(file, 'utf8');
}

function card(id: string): Component {
	return {
		id,
		component: 'NMCard',
		props: {
			id,
			title: 'Show',
			data: {
				id,
				title: 'Show',
				overview: 'A short overview.',
				backdrop: '/backdrop.jpg',
				poster: '/poster.jpg',
				link: '/tv/1',
			},
		},
	} as unknown as Component;
}

// The answer of /api/v1/home/tv: one lolomo whose items are carousels of cards.
function homeAnswer(): Component[] {
	const rail = {
		id: 'action',
		component: 'NMCarousel',
		props: {
			id: 'action',
			title: 'Action',
			more_link: '/genres/1',
			items: [card('00000000-0000-4000-8000-000000000001'), card('00000000-0000-4000-8000-000000000003')],
		},
	};

	return [{
		id: 'home',
		component: 'NMLolomo',
		props: { id: 'home', items: [rail] },
	}] as unknown as Component[];
}

function album(id: string): Component {
	return {
		id,
		component: 'NMMusicCard',
		props: { id, data: {
			id,
			title: 'Album',
			type: 'album',
			cover: null,
		} },
	} as unknown as Component;
}

function mountScreen(data: Component[]): ReturnType<typeof mount> {
	return mount(HeroRailsView, {
		props: {
			restorationKey: 'layout-test',
			data,
			isLoading: false,
			refetch: vi.fn(),
			errorContext: 'Couldn\'t load home',
			emptyMessage: 'Nothing here.',
		},
	});
}

describe('the home page keeps its layout while the hero and the cards load', () => {
	beforeEach(() => {
		focusedCardStore.seed(null);
	});

	// A renderer chunk still loading when the test file ends fails the run.
	afterEach(async () => {
		await flushPromises();
		await vi.dynamicImportSettled();
	});

	it('draws the hero in the first frame that shows the rails, before any card has focus', async () => {
		const wrapper = mountScreen(homeAnswer());

		await nextTick();

		expect(wrapper.find('.nm-hero-rails-screen > .hero').exists()).toBe(true);
		expect(wrapper.find('.hero .nm-hero-overview').text()).toBe('A short overview.');
		expect(wrapper.find('.nm-hero-rails').classes()).not.toContain('nm-hero-rails--no-hero');
	});

	it('leaves no hero space above a page without hero art (Music, positive control)', async () => {
		// The hero seeds from the first card, art or not (NMLolomo.kt:194-198), so Music says it has none.
		const wrapper = mount(HeroRailsView, {
			props: {
				restorationKey: 'layout-test-music',
				hero: false,
				data: [{
					id: 'albums',
					component: 'NMCarousel',
					props: {
						id: 'albums',
						title: 'Albums',
						items: [album('00000000-0000-4000-8000-000000000002')],
					},
				}] as unknown as Component[],
				isLoading: false,
				refetch: vi.fn(),
				errorContext: 'Couldn\'t load home',
				emptyMessage: 'Nothing here.',
			},
		});

		await nextTick();

		expect(wrapper.find('.nm-hero-rails-screen > .hero').exists()).toBe(false);
		expect(wrapper.find('.nm-hero-rails').classes()).toContain('nm-hero-rails--no-hero');
	});

	it('draws no hero on a page that says it has none, also when a card seeds or takes focus (Music)', async () => {
		const wrapper = mount(HeroRailsView, {
			props: {
				restorationKey: 'layout-no-hero',
				data: homeAnswer(),
				isLoading: false,
				refetch: vi.fn(),
				errorContext: 'x',
				emptyMessage: 'x',
				hero: false,
			},
		});

		await nextTick();
		expect(wrapper.find('.nm-hero-rails-screen > .hero').exists()).toBe(false);
		expect(wrapper.find('.nm-hero-rails').classes()).toContain('nm-hero-rails--no-hero');

		focusedCardStore.seed({
			id: '00000000-0000-4000-8000-000000000004',
			title: 'Album',
			poster: '/poster.jpg',
		});

		await nextTick();
		expect(wrapper.find('.nm-hero-rails-screen > .hero').exists()).toBe(false);
		expect(wrapper.find('.nm-hero-rails').classes()).toContain('nm-hero-rails--no-hero');
	});

	it('keeps the hero room and its rail overlap while the first load draws skeleton rails', async () => {
		const wrapper = mount(HeroRailsView, {
			props: {
				restorationKey: 'layout-loading',
				data: undefined,
				isLoading: true,
				refetch: vi.fn(),
				errorContext: 'x',
				emptyMessage: 'x',
			},
		});

		await nextTick();
		expect(wrapper.find('.nm-hero-rails-screen > .nm-hero-room + .nm-hero-rails').exists()).toBe(true);
		expect(wrapper.find('.nm-hero-rails').classes()).not.toContain('nm-hero-rails--no-hero');
		expect(wrapper.find('.nm-hero-rails .skeleton').exists()).toBe(true);
		expect(source('../styles/components.css')).toMatch(/\.nm-hero-room\s*\{[^}]*height:\s*var\(--hero-height\)/);
		expect(source('./home/HomeHero.vue')).toMatch(/\.hero\s*\{[^}]*height:\s*var\(--hero-height\)/);
	});

	it('keeps no hero room while a page without a hero loads', async () => {
		const wrapper = mount(HeroRailsView, {
			props: {
				restorationKey: 'layout-loading-no-hero',
				data: undefined,
				isLoading: true,
				refetch: vi.fn(),
				errorContext: 'x',
				emptyMessage: 'x',
				hero: false,
			},
		});

		await nextTick();
		expect(wrapper.find('.nm-hero-room').exists()).toBe(false);
		expect(wrapper.find('.nm-hero-rails').classes()).toContain('nm-hero-rails--no-hero');
	});

	it('keeps the hero text clear of the rails that reach up into the hero', () => {
		expect(source('../styles/tokens.css')).toMatch(/--hero-rails-overlap:\s*10px/);
		expect(source('../styles/components.css')).toMatch(/\.nm-hero-rails\s*\{[^}]*margin-top:\s*calc\(-1 \* var\(--hero-rails-overlap\)\)/);
		expect(source('./home/HomeHero.vue')).toMatch(/\.content\s*\{[^}]*padding:\s*0 16px 12px 40px/);
		expect(source('../styles/components.css')).toMatch(/\.nm-hero-overview\s*\{[^}]*line-height:\s*20px;[^}]*-webkit-line-clamp:\s*5/);
		expect(source('../styles/components.css')).toMatch(/\.nm-hero-logo\s*\{[^}]*max-height:\s*58px/);
	});

	it('does not scroll the rails for the first focus the page makes, but does for a key press', async () => {
		const scroll = vi.fn();

		Element.prototype.scrollIntoView = scroll;
		const wrapper = mount(HeroRailsView, {
			attachTo: document.body,
			props: {
				restorationKey: `first-scroll-${Math.random()}`,
				data: homeAnswer(),
				isLoading: false,
				refetch: vi.fn(),
				errorContext: 'x',
				emptyMessage: 'x',
			},
		});

		await flushPromises();
		await vi.dynamicImportSettled();
		await flushPromises();

		expect(document.activeElement).toBe(wrapper.find('[data-rail-id="action"] [data-focusable]').element);
		expect(scroll).not.toHaveBeenCalled();

		const { focusStore: store } = await import('@/stores/focusStore');
		// The rail's own group moves right; the page group above it only moves up and down.
		const moved = [...store.groupStack.value].reverse().some((group) => group.containsFocused() && group.handleKey('right'));

		expect(moved).toBe(true);
		expect(scroll).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('draws no Show All card alone while the cards of its rail are not drawn yet', () => {
		expect(source('../server-components/NMCarousel.vue')).toMatch(/\.show-all:only-child\s*\{[^}]*visibility:\s*hidden/);
	});

	it('keeps one card row of room in a rail that has drawn no card yet', () => {
		expect(source('../components/rails/HorizontalRail.vue')).toMatch(/\.rail-track:empty\s*\{[^}]*min-height:\s*calc\(var\(--rail-card-height\)/);
	});
});
