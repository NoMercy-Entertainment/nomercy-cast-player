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

	it('shows the error and Try again when the request failed', async () => {
		const wrapper = await screen({ data: undefined, error: new Error('timeout') });

		expect(wrapper.text()).toContain('Couldn\'t load music');
		expect(wrapper.text()).toContain('Try again');
	});
});
