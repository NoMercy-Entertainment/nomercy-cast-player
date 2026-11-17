import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Resolver from './Resolver.vue';
import type { Component } from './types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

Element.prototype.scrollIntoView = vi.fn();

function grid(properties: Record<string, number> | undefined): Component {
	const card = {
		id: 'c1',
		component: 'NMCard',
		props: { id: 'c1', data: {
			id: 'c1',
			title: 'One',
			poster: '/one.jpg',
		} },
	};

	return {
		id: 'g',
		component: 'NMGrid',
		props: {
			id: 'g',
			items: [card],
			properties,
		},
	} as unknown as Component;
}

async function track(properties: Record<string, number> | undefined): Promise<HTMLElement> {
	const wrapper = mount(Resolver, { props: { component: grid(properties) } });

	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();

	return wrapper.get('.grid-track').element as HTMLElement;
}

// NMGrid.kt:41-66: on TV the columns clamp to 4..6 with a default of 2; spacing and padding come from properties.
describe('the grid takes its columns and spacing like the native TV grid', () => {
	it('raises a server count of 2 to 4 columns', async () => {
		expect((await track({ columns: 2 })).style.getPropertyValue('--cols')).toBe('4');
	});

	it('lowers a server count of 9 to 6 columns', async () => {
		expect((await track({ columns: 9 })).style.getPropertyValue('--cols')).toBe('6');
	});

	it('uses 4 columns when the server sends none', async () => {
		expect((await track(undefined)).style.getPropertyValue('--cols')).toBe('4');
	});

	it('keeps a count inside the range (positive control)', async () => {
		expect((await track({ columns: 5 })).style.getPropertyValue('--cols')).toBe('5');
	});

	it('takes the gap from the spacing property', async () => {
		expect((await track({ spacing: 8 })).style.gap).toBe('8px');
	});

	it('takes the top padding from the paddingTop property', async () => {
		expect((await track({ paddingTop: 12 })).style.paddingTop).toBe('12px');
	});
});
