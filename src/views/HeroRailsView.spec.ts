import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import HeroRailsView from './HeroRailsView.vue';
import type { Component } from '@/server-components/types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

// jsdom has no layout, so it has no scrollIntoView; focusing a card calls it.
Element.prototype.scrollIntoView = vi.fn();

const EMPTY_MESSAGE = 'No music yet. Add a music library to get started.';

function carousel(id: string, items: Component[]): Component {
	return { id, component: 'NMCarousel', props: { id, title: id, items } };
}

function album(id: string): Component {
	return {
		id,
		component: 'NMMusicCard',
		props: { id, data: { id, title: 'Album', type: 'album', cover: null } },
	} as unknown as Component;
}

function groupCard(id: string): Component {
	return {
		id,
		component: 'NMGroupCard',
		props: {
			id,
			data: {
				id,
				title: 'Rock',
				type: 'genre',
				link: '/music/genres/00000000-0000-4000-8000-000000000002',
				have_items: 2,
				item_posters: [{ src: 'https://example.com/cover-one.jpg' }, { src: 'https://example.com/cover-two.jpg' }],
			},
		},
	} as unknown as Component;
}

async function screen(overrides: Record<string, unknown>): Promise<ReturnType<typeof mount>> {
	const wrapper = mount(HeroRailsView, {
		props: {
			restorationKey: 'music-start-rails-test',
			data: [],
			isLoading: false,
			refetch: vi.fn(),
			errorContext: 'Couldn\'t load music',
			emptyMessage: EMPTY_MESSAGE,
			...overrides,
		},
	});
	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();
	return wrapper;
}

describe('the music page never ends blank', () => {
	it('shows the rail when the answer has one album rail (positive control)', async () => {
		const wrapper = await screen({ data: [carousel('albums', [album('00000000-0000-4000-8000-000000000001')])] });

		expect(wrapper.find('[data-rail-id="albums"]').exists()).toBe(true);
	});

	it('draws the group cards of a genre rail', async () => {
		const wrapper = await screen({ data: [carousel('genres', [groupCard('00000000-0000-4000-8000-000000000003')])] });

		expect(wrapper.find('[data-rail-id="genres"]').exists()).toBe(true);
		expect(wrapper.find('.group-card').exists()).toBe(true);
		expect(wrapper.find('.group-card img').attributes('src')).toBe('https://example.com/cover-one.jpg');
		expect(wrapper.text()).toContain('Rock');
	});

	it('shows the empty message when the only rail holds a type the receiver cannot draw', async () => {
		const unknown = { id: 'x', component: 'NMFutureCard', props: { id: 'x', data: {} } } as unknown as Component;

		const wrapper = await screen({ data: [carousel('future', [unknown])] });

		expect(wrapper.text()).toContain(EMPTY_MESSAGE);
	});

	it('shows the empty message when every rail in the answer has no items', async () => {
		const empty = [
			{ id: 'favorites', component: 'NMContainer', props: { id: 'favorites', items: [] } },
			carousel('favorite-artists', []),
			carousel('albums', []),
		] as Component[];

		const wrapper = await screen({ data: empty });

		expect(wrapper.text()).toContain(EMPTY_MESSAGE);
	});

	it('shows the empty message when the only component is a lolomo of empty rails', async () => {
		const lolomo = [
			{
				id: 'music-carousels',
				component: 'NMLolomo',
				props: { id: 'music-carousels', items: [carousel('albums', [])] },
			},
		] as Component[];

		const wrapper = await screen({ data: lolomo });

		expect(wrapper.text()).toContain(EMPTY_MESSAGE);
	});

	it('lets the rails fill the screen below the nav when no hero art sits above them', async () => {
		const wrapper = await screen({ data: [carousel('albums', [album('00000000-0000-4000-8000-000000000001')])] });

		expect(wrapper.find('.nm-hero-rails').classes()).toContain('nm-hero-rails--no-hero');
	});

	it('draws the loading rails inside the rails box, each with a title bar and a row of cards', async () => {
		const wrapper = await screen({ data: undefined, isLoading: true, skeletonCount: 2 });

		const placeholders = wrapper.findAll('.skeleton');
		expect(placeholders).toHaveLength(2);
		expect(wrapper.findAll('.nm-hero-rails .skeleton')).toHaveLength(2);
		expect(wrapper.find('.nm-hero-rails').classes()).toContain('nm-hero-rails--no-hero');
		for (const placeholder of placeholders) {
			expect(placeholder.find('.skeleton-title').exists()).toBe(true);
			expect(placeholder.findAll('.skeleton-item').length).toBeGreaterThan(1);
		}
	});

	it('draws the real rails in the same box once the answer is there (positive control)', async () => {
		const wrapper = await screen({ data: [carousel('albums', [album('00000000-0000-4000-8000-000000000001')])] });

		expect(wrapper.findAll('.nm-hero-rails [data-rail-id="albums"]')).toHaveLength(1);
		expect(wrapper.find('.skeleton').exists()).toBe(false);
	});

	it('shows the error and Try again when the request failed', async () => {
		const wrapper = await screen({ data: undefined, error: new Error('timeout') });

		expect(wrapper.text()).toContain('Couldn\'t load music');
		expect(wrapper.text()).toContain('Try again');
	});
});

describe('a page opened by the sender gets its first focus', () => {
	async function mountAttached(data: Component[] | undefined, isLoading: boolean): Promise<ReturnType<typeof mount>> {
		const wrapper = mount(HeroRailsView, {
			attachTo: document.body,
			props: {
				restorationKey: `first-focus-${Math.random()}`,
				data,
				isLoading,
				refetch: vi.fn(),
				errorContext: 'Couldn\'t load music',
				emptyMessage: EMPTY_MESSAGE,
			},
		});
		await flushPromises();
		return wrapper;
	}

	async function settle(): Promise<void> {
		await flushPromises();
		await vi.dynamicImportSettled();
		await flushPromises();
	}

	const rails = (): Component[] => [
		carousel('albums', [
			album('00000000-0000-4000-8000-000000000001'),
			album('00000000-0000-4000-8000-000000000002'),
		]),
		carousel('more', [album('00000000-0000-4000-8000-000000000003')]),
	];

	it('focuses the first card when the answer is there at mount (positive control)', async () => {
		const wrapper = await mountAttached(rails(), false);
		await settle();

		const first = wrapper.find('[data-rail-id="albums"] [data-focusable]').element;
		expect(document.activeElement).toBe(first);
		wrapper.unmount();
	});

	it('focuses the first card when the answer arrives after mount', async () => {
		const wrapper = await mountAttached(undefined, true);
		await settle();
		expect(document.activeElement).toBe(document.body);

		await wrapper.setProps({ data: rails(), isLoading: false });
		await settle();

		const first = wrapper.find('[data-rail-id="albums"] [data-focusable]').element;
		expect(document.activeElement).toBe(first);
		wrapper.unmount();
	});

	it('focuses the first card when the answer replaces an error panel', async () => {
		const wrapper = mount(HeroRailsView, {
			attachTo: document.body,
			props: {
				restorationKey: `first-focus-${Math.random()}`,
				data: undefined,
				isLoading: false,
				error: new Error('timeout'),
				refetch: vi.fn(),
				errorContext: 'Couldn\'t load music',
				emptyMessage: EMPTY_MESSAGE,
			},
		});
		await settle();
		(document.activeElement as HTMLElement | null)?.blur();

		await wrapper.setProps({ data: rails(), error: null });
		await settle();

		const first = wrapper.find('[data-rail-id="albums"] [data-focusable]').element;
		expect(document.activeElement).toBe(first);
		wrapper.unmount();
	});

	it('moves focus down to the next rail when the first rail has no Show All', async () => {
		const wrapper = await mountAttached(undefined, true);
		await wrapper.setProps({ data: rails(), isLoading: false });
		await settle();

		const { focusStore } = await import('@/stores/focusStore');
		expect(focusStore.activeGroup()?.handleKey('down')).toBe(true);
		const next = wrapper.find('[data-rail-id="more"] [data-focusable]').element;
		expect(document.activeElement).toBe(next);
		wrapper.unmount();
	});

	it('moves focus on from the first card with a key', async () => {
		const wrapper = await mountAttached(undefined, true);
		await wrapper.setProps({ data: rails(), isLoading: false });
		await settle();

		const { focusStore } = await import('@/stores/focusStore');
		expect(focusStore.activeGroup()?.handleKey('right')).toBe(true);
		const cards = wrapper.findAll('[data-rail-id="albums"] [data-focusable]');
		expect(document.activeElement).toBe(cards[1].element);
		wrapper.unmount();
	});
});
