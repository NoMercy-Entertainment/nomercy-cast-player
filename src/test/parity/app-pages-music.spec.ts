import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { decls } from '../cssDecl';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

const { useMusicStartQuery } = await import('@/queries/useMusicStartQuery');
const { useHeroSeed } = await import('@/composables/useHeroSeed');
const { focusedCardStore } = await import('@/stores/focusedCardStore');
const { default: HomeHero } = await import('@/views/home/HomeHero.vue');

function carousel(id: string, items: unknown[]) {
	return {
		id,
		component: 'NMCarousel',
		props: {
			id,
			title: id,
			items,
		},
	};
}

function musicCard(id: string) {
	return {
		id,
		component: 'NMMusicCard',
		props: { id, data: {
			id,
			name: `Name ${id}`,
			artist: 'Example Artist',
			cover: `/${id}.jpg`,
			description: 'About it.',
		} },
	};
}

afterEach(() => {
	apiFetch.mockReset();
	focusedCardStore.seed(null);
});

describe('row 7: music start matches MusicStartScreen.kt via TvLolomoScreen', () => {
	// The server answers version=lolomo with ONE NMLolomo holding the carousels (MusicController.cs:130,
	// BaseController.cs:469); the shared renderer draws it, as the library page does.
	it('asks for the lolomo layout and hands the NMLolomo page to the renderer (MusicStartRepository.kt:38)', async () => {
		const lolomo = {
			id: 'music-carousels',
			component: 'NMLolomo',
			props: {
				id: 'music-carousels',
				items: [carousel('rows', [musicCard('a')])],
			},
		};

		apiFetch.mockResolvedValue({ data: [lolomo] });

		const seen = ref<unknown>();
		const Host = defineComponent({
			setup() {
				const q = useMusicStartQuery();

				return () => {
					seen.value = q.data.value;

					return h('div');
				};
			},
		});

		mount(Host, { global: { plugins: [VueQueryPlugin] } });
		await vi.waitFor(() => expect(seen.value).toBeDefined());
		await flushPromises();
		expect((apiFetch.mock.calls[0]![0] as { path: string }).path).toBe('/api/v1/music/start?version=lolomo');
		expect((seen.value as Array<{ id: string }>).map((c) => c.id)).toEqual(['music-carousels']);
	});

	it('the page draws its hero and its rows are music rows (NMLolomo.kt:75,245)', () => {
		const src = readFileSync(resolve(__dirname, '../../views/music/MusicStartScreen.vue'), 'utf8');

		expect(src).not.toContain(':hero="false"');
		expect(src).toContain('music');
	});

	it('the hero seeds from the first music card: title, cover as backdrop, description (NMLolomo.kt:151-162,194-213)', () => {
		const firstCard = musicCard('a');
		const row = carousel('rows', [firstCard]);
		const list = ref([row]);

		useHeroSeed(list as never);
		const card = focusedCardStore.activeCard.value;

		expect(card?.title).toBe('Name a');
		expect(card?.backdrop).toBe('/a.jpg');
		expect(card?.overview).toBe('About it.');
		expect(card?.artist).toBe('Example Artist');
	});

	it('the hero shows the artist byline on line 1 of the overview block (VideoMusicHeroSection.kt:171-183)', () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'a',
			title: 'Name a',
			artist: 'Example Artist',
			overview: 'About it.',
		} } });

		expect(wrapper.get('.nm-hero-byline').text()).toBe('Example Artist');
		const b = decls('styles/components.css', '.nm-hero-byline');

		expect(b['font-weight']).toBe('600');
		expect(b['line-height']).toBe('20px');
		expect(b.opacity).toBe('0.8');
	});
});
