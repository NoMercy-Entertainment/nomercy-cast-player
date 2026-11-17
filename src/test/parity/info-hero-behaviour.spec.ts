import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { decls } from '../cssDecl';

const apiFetch = vi.fn<(options: Record<string, unknown>) => Promise<unknown>>();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

Element.prototype.scrollIntoView = vi.fn();

const { default: InfoScreen } = await import('@/views/info/InfoScreen.vue');
const { focusedCardStore } = await import('@/stores/focusedCardStore');
const { settingsStore } = await import('@/stores/settingsStore');
const { QueryKeys } = await import('@/queries/keys');

const BASE = {
	id: 'title-1',
	title: 'Base Title',
	overview: 'Base overview.',
	link: '/movie/1',
	watchlist: false,
	backdrop: '/base.jpg',
	color_palette: { poster: { dominant: '#3a5fa0' } },
};

let wrapper: VueWrapper;
let client: QueryClient;

async function mountInfo(base: Record<string, unknown> = BASE) {
	apiFetch.mockImplementation(({ path }: { path: string }) =>
		Promise.resolve(path.includes('/watch-list') ? { status: 'ok' } : { data: base }));
	client = new QueryClient();
	const router = createRouter({ history: createWebHistory(), routes: [] });

	wrapper = mount(InfoScreen, {
		props: { type: 'movie', id: '1' },
		attachTo: document.body,
		global: { plugins: [[VueQueryPlugin, { queryClient: client }], router] },
	});
	await vi.waitFor(() => expect(wrapper.find('.hero-row').exists()).toBe(true));
	await flushPromises();
}

const accent = () => document.documentElement.style.getPropertyValue('--color-primary');
const heroText = () => wrapper.get('.hero-row').text();

beforeEach(() => {
	focusedCardStore.seed(null);
	settingsStore.useAutoThemeColors.value = true;
});

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
	apiFetch.mockReset();
});

describe('InfoScreen.kt:181-186: the page color follows the auto theme setting', () => {
	it('with the setting off the poster palette is not applied', async () => {
		settingsStore.useAutoThemeColors.value = false;
		await mountInfo();

		expect(accent()).toBe('');
	});

	it('with the setting on and no poster palette the backdrop palette is not used', async () => {
		await mountInfo({ ...BASE, color_palette: { backdrop: { dominant: '#aa2233' } } });

		expect(accent()).toBe('');
	});

	it('with the setting on the poster palette is applied', async () => {
		await mountInfo();

		expect(accent()).not.toBe('');
	});
});

describe('NMDetailActions.kt:104: focus on the actions row returns the hero to the base title', () => {
	it('the hero shows a focused collection movie, then the title again on the Watch button', async () => {
		await mountInfo();
		focusedCardStore.setActive({ type: 'movie', title: 'Part Two', overview: 'Second.', backdrop: '/two.jpg' });
		await vi.waitFor(() => expect(heroText()).toContain('Part Two'), { timeout: 3000 });

		wrapper.get('.actions .nm-pill-primary').element.focus();
		await vi.waitFor(() => expect(heroText()).toContain('Base Title'), { timeout: 4000 });
		expect(wrapper.get('.backdrop img').attributes('src')).toContain('/base.jpg');
	});
});

describe('VideoMusicHeroSection.kt:112-137: the hero text crossfades in 200 ms', () => {
	it('the title block and the overview sit in a fading transition', async () => {
		await mountInfo();

		const html = wrapper.html();

		expect(html.match(/name="hero-fade"/g)?.length).toBeGreaterThanOrEqual(2);
		expect(decls('views/info/InfoScreen.vue', '.hero-fade-enter-active').transition).toBe('opacity 200ms');
	});
});

describe('NMDetailActions.kt:139-145: a watchlist toggle reaches every cached query', () => {
	it('a cached card of the same title follows the toggle and goes back when the POST fails', async () => {
		await mountInfo();
		client.setQueryData(['library', 'example'], [{ id: 'row', component: 'NMCarousel', props: { items: [
			{ id: 'c', component: 'NMCard', props: { data: { id: '1', link: '/movie/1', watchlist: false } } },
		] } }]);
		const cached = () => JSON.stringify(client.getQueryData(['library', 'example']));

		wrapper.get('.actions .nm-pill-secondary').element.click();
		await vi.waitFor(() => expect(cached()).toContain('"watchlist":true'));
		expect((client.getQueryData([...QueryKeys.info('movie', '1')]) as { watchlist: boolean }).watchlist).toBe(true);

		apiFetch.mockImplementation(() => Promise.reject(new Error('offline')));
		wrapper.get('.actions .nm-pill-secondary').element.click();
		await vi.waitFor(() => expect(cached()).toContain('"watchlist":true'));
		await flushPromises();
		expect(cached()).toContain('"watchlist":true');
	});
});
