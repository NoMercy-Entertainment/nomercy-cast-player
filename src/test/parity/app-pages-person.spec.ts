import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

vi.mock('vue-router', async (original) => ({
	...await original<typeof import('vue-router')>(),
	useRoute: () => ({ params: { id: '7' } }),
}));

vi.mock('i18next-vue', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const seen: { data?: Array<{ id: string }>; persistentHero?: Record<string, unknown> } = {};

vi.mock('@/views/HeroRailsView.vue', () => ({
	default: defineComponent({
		props: ['data', 'persistentHero'],
		setup(props) {
			return () => {
				seen.data = props.data;
				seen.persistentHero = props.persistentHero;

				return h('div');
			};
		},
	}),
}));

const { default: router } = await import('@/router');
const { default: PersonScreen } = await import('@/views/person/PersonScreen.vue');

const hero = {
	id: 'person-hero',
	component: 'NMHomeCard',
	props: { data: {
		id: 7,
		title: 'Example Person',
		overview: 'An example biography.',
		backdrop: '/known-for.jpg',
		poster: '/profile.jpg',
	} },
};
const rows = {
	id: 'person-7',
	component: 'NMLolomo',
	props: {
		id: 'person-7',
		hero: 'none',
		items: [],
	},
};

async function mountWith(response: unknown) {
	apiFetch.mockResolvedValue(response);
	mount(PersonScreen, { global: { plugins: [VueQueryPlugin] } });
	await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
	await flushPromises();
}

afterEach(() => {
	apiFetch.mockReset();
	seen.data = undefined;
	seen.persistentHero = undefined;
});

describe('row 6: the person page draws the components the server sends', () => {
	it('the route mounts a view, it no longer redirects home (router/index.ts)', () => {
		const route = router.getRoutes().find((r) => r.name === 'person');

		expect(route?.redirect).toBeUndefined();
		expect(route?.components?.default).toBeDefined();
	});

	it('asks for the lolomo layout and hands the rows to the shared renderer', async () => {
		await mountWith({ data: [hero, rows] });

		expect((apiFetch.mock.calls[0]![0] as { path: string }).path).toBe('/api/v1/person/7?version=lolomo');
		expect(seen.data?.map((c) => c.id)).toEqual(['person-7']);
	});

	it('the NMHomeCard is the fixed hero, with the backdrop and without the profile photo (tv/PersonScreen.kt:156)', async () => {
		await mountWith({ data: [hero, rows] });

		expect(seen.persistentHero).toMatchObject({ title: 'Example Person', backdrop: '/known-for.jpg' });
		expect(seen.persistentHero?.poster).toBeUndefined();
	});

	it('an older server that answers the plain person object draws the empty page', async () => {
		await mountWith({ data: {
			id: '7',
			name: 'Example Person',
			known_for: [],
		} });

		expect(seen.data).toEqual([]);
		expect(seen.persistentHero).toBeUndefined();
	});
});
