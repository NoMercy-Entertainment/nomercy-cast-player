import { VueQueryPlugin } from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

const { default: InfoScreen } = await import('./InfoScreen.vue');

describe('the Info screen watchlist button on a cold load', () => {
	beforeEach(() => {
		apiFetch.mockReset();
	});

	it('toggles the watchlist on a fresh (uncached) load when clicked', async () => {
		let resolveInfo!: (value: unknown) => void;
		apiFetch.mockImplementation(({ path }: { path: string }) => {
			if (path.includes('/watch-list')) {
				return Promise.resolve({ status: 'ok' });
			}
			return new Promise((resolve) => {
				resolveInfo = resolve;
			});
		});

		const router = createRouter({ history: createWebHistory(), routes: [] });

		const wrapper = mount(InfoScreen, {
			props: { type: 'movies', id: 'title-1' },
			global: { plugins: [VueQueryPlugin, router] },
		});

		// Info query resolves after mount — the watchlist button only exists
		// once this happens, same as a cold (uncached) page load.
		resolveInfo({
			data: {
				id: 'title-1',
				title: 'Example Title',
				link: '/movies/title-1',
				watchlist: false,
			},
		});
		await vi.waitFor(() => expect(wrapper.text()).toContain('Add to watchlist'));

		await wrapper.get('.nm-pill-secondary').trigger('click');
		await vi.waitFor(() => expect(apiFetch.mock.calls.some(call => (call[0] as { path: string }).path.includes('/watch-list'))).toBe(true));

		const watchlistCall = apiFetch.mock.calls.find(call => (call[0] as { path: string }).path.includes('/watch-list'));
		expect(JSON.parse((watchlistCall![0] as { body: string }).body)).toEqual({ add: true });
	});
});
