import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { decls } from '@/test/cssDecl';
import HomeHero from './HomeHero.vue';

const CSS = 'styles/components.css';

describe('the hero backdrop follows the native hero (NMLolomo.kt:169)', () => {
	it('draws no image for a card that has only a poster', () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'p',
			title: 'Poster only',
			poster: '/p.jpg',
		} } });

		expect(wrapper.find('.art img').exists()).toBe(false);
	});

	it('draws the backdrop of a card (positive control)', () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'b',
			title: 'Backdrop',
			backdrop: '/b.jpg',
		} } });

		expect(wrapper.find('.art img').attributes('src')).toContain('/b.jpg');
	});

	it('keeps the previous slide when the next card has no backdrop', async () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'b',
			title: 'Backdrop',
			backdrop: '/b.jpg',
		} } });

		await wrapper.setProps({ card: {
			id: 'p',
			title: 'Poster only',
			poster: '/p.jpg',
		} });

		expect(wrapper.find('.art img').attributes('src')).toContain('/b.jpg');
	});

	it('crops the backdrop from the center (BackdropImageWithOverlay.kt:236-246)', () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'b',
			title: 'Backdrop',
			backdrop: '/b.jpg',
		} } });

		expect(wrapper.find('.art img').classes()).toContain('nm-cover-center');
		expect(wrapper.find('.art img').classes()).not.toContain('nm-cover-top');
	});
});

describe('the hero text and scrim scale with the screen', () => {
	it('lets the overview fill its 60 percent column (VideoMusicHeroSection.kt:82,107)', () => {
		expect(decls(CSS, '.nm-hero-overview')['max-width']).toBeUndefined();
	});

	it('sizes the scrim from the screen, not from one fixed size (BackdropImageWithOverlay.kt:263-285)', () => {
		const background = decls(CSS, '.nm-hero-scrim').background ?? '';

		expect(background).not.toContain('1987px');
		expect(background).not.toContain('1728px');
		expect(background).toContain('100vw');
	});
});
