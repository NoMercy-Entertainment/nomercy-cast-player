import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { pickPaletteColor } from '@/lib/images/urls';
import NMCard from './NMCard.vue';
import type { NMCardWrapper } from './types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

// The server nests the palette per image: color_palette.poster, .backdrop, .still.
const palette = {
	poster: { dominant: '#3060c0' },
	backdrop: { dominant: '#c03030' },
	still: { dominant: '#30a050' },
};

function accentOf(data: Partial<NMCardWrapper>): string {
	const wrapper = mount(NMCard, {
		props: {
			id: 'c1',
			data: {
				id: 'c1',
				title: 'One',
				...data,
			},
		},
	});

	return (wrapper.get('.poster').element as HTMLElement).style.getPropertyValue('--card-accent');
}

// TvCardViewHolder.kt:86-102: each card borders in its own image palette, picked by how the card is shown.
describe('a card borders in its own artwork palette like the native TV card', () => {
	it('takes the poster palette for a poster card', () => {
		expect(accentOf({ color_palette: palette })).toBe(pickPaletteColor(palette.poster));
	});

	it('takes the still palette for a wide card', () => {
		expect(accentOf({ wide: true, color_palette: palette })).toBe(pickPaletteColor(palette.still));
	});

	it('falls back to the backdrop palette when a poster card has none', () => {
		const backdropOnly = { backdrop: palette.backdrop };

		expect(accentOf({ color_palette: backdropOnly })).toBe(pickPaletteColor(palette.backdrop));
	});

	it('leaves the page accent to a card with no palette (positive control)', () => {
		expect(accentOf({})).toBe('');
	});
});
