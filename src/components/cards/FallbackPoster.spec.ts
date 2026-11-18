import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { decls } from '@/test/cssDecl';
import AppLogoSquare from '@/layout/AppLogoSquare.vue';
import FallbackPoster from './FallbackPoster.vue';

// TvCardViewHolder.kt:195-205: a card with no artwork (a cast member with no photo) shows the
// brand logo mark centered on black, never initials.
describe('a card with no artwork shows the brand mark on black', () => {
	it('draws the logo square and no initials', () => {
		const wrapper = mount(FallbackPoster, { props: { title: 'Julian' } });

		expect(wrapper.findComponent(AppLogoSquare).exists()).toBe(true);
		expect(wrapper.text()).not.toContain('JU');
	});

	it('sits on a black card (positive control: the card keeps its box)', () => {
		const style = decls('components/cards/FallbackPoster.vue', '.fallback-poster');

		expect(style.width).toBe('100%');
		expect(style.background).toBe('var(--cast-black)');
	});
});
