import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Resolver from './Resolver.vue';
import type { Component } from './types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

// jsdom has no layout, so it has no scrollIntoView; a rail that mounts alone now takes first focus.
Element.prototype.scrollIntoView = vi.fn();

function homeCard(n: number): Component {
	const id = `00000000-0000-4000-8000-00000000010${n}`;

	return {
		id,
		component: 'NMMusicHomeCard',
		props: {
			id,
			data: {
				id,
				name: `Artist ${n}`,
				type: 'artist',
				cover: `https://example.com/cover-${n}.jpg`,
				link: `/music/artists/${id}`,
			},
		},
	} as unknown as Component;
}

function container(id: string, items: Component[]): Component {
	return {
		id,
		component: 'NMContainer',
		props: { id, items },
	} as unknown as Component;
}

async function draw(component: Component): Promise<ReturnType<typeof mount>> {
	const wrapper = mount(Resolver, { props: { component } });

	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();

	return wrapper;
}

describe('the Music favorites container', () => {
	it('draws its cards in one row with their cover and title', async () => {
		const cards = container('favorites-cards', [homeCard(1), homeCard(2), homeCard(3)]);
		const favorites = container('favorites', [cards]);

		const wrapper = await draw(favorites);

		const row = wrapper.find('.container-row');

		expect(row.exists()).toBe(true);
		expect(row.findAll('.music-home-card')).toHaveLength(3);

		expect(row.findAll('img').map((img) => img.attributes('src'))).toEqual([
			'https://example.com/cover-1.jpg',
			'https://example.com/cover-2.jpg',
			'https://example.com/cover-3.jpg',
		]);

		expect(row.text()).toContain('Artist 2');
	});

	it('stacks a container that holds sections instead of putting them in a row', async () => {
		const inner = container('inner', [homeCard(1)]);
		const stacked = container('sections', [inner]);

		const wrapper = await draw(stacked);

		expect(wrapper.find('.container-stack').exists()).toBe(true);
		expect(wrapper.find('.container-stack > .container-row').exists()).toBe(false);
	});

	it('still draws a carousel rail with one music card (positive control)', async () => {
		const id = '00000000-0000-4000-8000-000000000201';
		const rail = {
			id: 'albums',
			component: 'NMCarousel',
			props: {
				id: 'albums',
				title: 'Albums',
				items: [{
					id,
					component: 'NMMusicCard',
					props: { id, data: {
						id,
						title: 'Album',
						type: 'album',
						cover: null,
					} },
				}],
			},
		} as unknown as Component;

		const wrapper = await draw(rail);

		expect(wrapper.find('[data-rail-id="albums"]').exists()).toBe(true);
	});
});
