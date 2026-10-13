import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

const { default: Resolver } = await import('./Resolver.vue');

describe('an NMLolomo component from the server', () => {
	it('draws its NMCarousel items like NMContainer does, instead of drawing nothing', async () => {
		const wrapper = mount(Resolver, {
			props: {
				component: {
					id: 'lolomo1',
					component: 'NMLolomo',
					props: {
						id: 'lolomo1',
						title: 'For You',
						items: [
							{ id: 'row1', component: 'NMCarousel', props: { id: 'row1', title: 'Row', items: [] } },
						],
					},
				},
			},
			global: {
				stubs: {
					Resolver: { props: ['component'], template: '<div class="resolved">{{ component.component }}</div>' },
				},
			},
		});

		await vi.waitFor(() => expect(wrapper.find('.resolved').exists()).toBe(true));
		expect(wrapper.get('.resolved').text()).toBe('NMCarousel');
	});
});
