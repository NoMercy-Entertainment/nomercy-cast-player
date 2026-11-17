import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import NMCard from './NMCard.vue';
import type { NMCardWrapper } from './types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

const poster = {
	dominant: '#102030',
	lightVibrant: '#a0b0c0ff',
	darkVibrant: '#405060',
};

function posterStyle(data: Partial<NMCardWrapper>): CSSStyleDeclaration {
	const wrapper = mount(NMCard, {
		props: {
			id: 'c1',
			data: {
				id: 'c1',
				title: 'One',
				poster: '/one.jpg',
				...data,
			},
		},
	});

	return (wrapper.get('.poster').element as HTMLElement).style;
}

// PalettePlaceholder.kt:66-77 (KMP cf209837): the 4-corner wash a card shows while its image loads.
describe('a card shows its palette wash while the image loads, as the KMP TV card', () => {
	it('gives the corners light vibrant, dominant, dark vibrant, dominant with the KMP alphas', () => {
		const style = posterStyle({ color_palette: { poster } });

		expect([1, 2, 3, 4].map((i) => style.getPropertyValue(`--wash-${i}`))).toEqual([
			'#a0b0c0bf',
			'#102030b3',
			'#405060cc',
			'#102030b3',
		]);
	});

	it('draws no wash when the palette lacks a corner color (positive control)', () => {
		const style = posterStyle({ color_palette: { poster: { dominant: '#102030' } } });

		expect(style.getPropertyValue('--wash-1')).toBe('');
	});
});
