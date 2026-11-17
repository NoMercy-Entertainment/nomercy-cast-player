import { VueQueryPlugin } from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn<(options: Record<string, unknown>) => Promise<unknown>>();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

const { default: InfoScreen } = await import('./InfoScreen.vue');
const { focusedCardStore } = await import('@/stores/focusedCardStore');

async function mountInfo() {
	apiFetch.mockResolvedValue({
		data: {
			id: 'title-1',
			title: 'Base Title',
			overview: 'Base overview.',
			link: '/movies/title-1',
			watchlist: false,
			backdrop: '/base.jpg',
			color_palette: { poster: { dominant: '#3a5fa0' } },
		},
	});

	const router = createRouter({ history: createWebHistory(), routes: [] });
	const wrapper = mount(InfoScreen, {
		props: { type: 'movies', id: 'title-1' },
		global: { plugins: [VueQueryPlugin, router] },
	});

	await vi.waitFor(() => expect(wrapper.find('.hero-row').exists()).toBe(true));

	return wrapper;
}

const accent = () => document.documentElement.style.getPropertyValue('--color-primary');

// InfoScreen.kt:189-204 and HeroCardGate.kt:18-21: a focused movie or tv card with a backdrop takes over the hero.
describe('the info hero follows a focused title card like InfoScreen.kt', () => {
	beforeEach(() => {
		apiFetch.mockReset();
		focusedCardStore.seed(null);
	});

	it('shows the focused collection card, then the base title when a person card takes focus', async () => {
		const wrapper = await mountInfo();

		expect(wrapper.get('.hero-row').text()).toContain('Base Title');

		focusedCardStore.setActive({
			type: 'movie',
			title: 'Part Two',
			overview: 'Second overview.',
			backdrop: '/two.jpg',
		});

		await vi.waitFor(() => expect(wrapper.get('.hero-row').text()).toContain('Part Two'));
		expect(wrapper.get('.hero-row').text()).toContain('Second overview.');
		expect(wrapper.get('.backdrop img').attributes('src')).toContain('/two.jpg');

		focusedCardStore.setActive({
			type: 'person',
			title: 'Some Person',
			backdrop: '/p.jpg',
		});

		// HeroSelectionTiming.kt:33: the hero holds 1400 ms before the next change.
		await vi.waitFor(() => expect(wrapper.get('.hero-row').text()).toContain('Base Title'), { timeout: 3000 });
	});

	it('keeps the title poster color while focus moves over cards without a palette', async () => {
		const wrapper = await mountInfo();
		const before = accent();

		expect(before).not.toBe('');

		focusedCardStore.setActive({ type: 'person', title: 'Some Person' });
		await new Promise((resolve) => setTimeout(resolve, 400));

		expect(wrapper.get('.hero-row').text()).toContain('Base Title');
		expect(accent()).toBe(before);
	});
});
