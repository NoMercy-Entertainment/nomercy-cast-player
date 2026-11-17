import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

vi.mock('i18next-vue', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const seen: { data?: Array<{
	id: string;
	component: string;
	props: { items: Array<{ id: string }> };
}>; empty?: string; } = {};

vi.mock('@/views/HeroRailsView.vue', () => ({
	default: defineComponent({
		props: ['data', 'emptyMessage'],
		setup(props) {
			return () => {
				seen.data = props.data;
				seen.empty = props.emptyMessage;

				return h('div');
			};
		},
	}),
}));

const { default: FavoritesScreen } = await import('@/views/favorites/FavoritesScreen.vue');

async function mountWith(response: unknown) {
	apiFetch.mockResolvedValue(response);
	mount(FavoritesScreen, { global: { plugins: [VueQueryPlugin] } });
	await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
	await flushPromises();
}

afterEach(() => {
	apiFetch.mockReset();
	seen.data = undefined;
});

describe('favoritesScreen.kt:42-87: userData/favorites is one grid of cards', () => {
	it('wraps the flat card list in one NMGrid whose card ids carry the type', async () => {
		await mountWith({ data: [
			{
				id: 5,
				title: 'Example Film',
				type: 'movie',
				link: '/movie/5',
			},
			{
				id: 5,
				title: 'Example Show',
				type: 'tv',
				link: '/tv/5',
			},
		] });

		expect((apiFetch.mock.calls[0]![0] as { path: string }).path).toBe('/api/v1/userData/favorites');
		expect(seen.data).toHaveLength(1);
		expect(seen.data![0]!.component).toBe('NMGrid');
		expect(seen.data![0]!.props.items.map((i) => i.id)).toEqual(['movie-5', 'tv-5']);
	});

	it('no favorites is an empty list and the favorites_empty message', async () => {
		await mountWith({ data: [] });

		expect(seen.data).toEqual([]);
		expect(seen.empty).toBe('views.favorites.empty');
	});
});
