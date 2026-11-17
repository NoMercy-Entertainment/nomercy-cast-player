import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

Element.prototype.scrollIntoView = vi.fn();

const { default: InfoScreen } = await import('@/views/info/InfoScreen.vue');

function episode(id: number, season: number, title: string) {
	return {
		id,
		episode_number: 1,
		season_number: season,
		title,
		still: null,
		link: `/tv/9/watch?season=${season}&episode=1`,
	};
}

const SEASONS = [
	{
		id: 1,
		season_number: 1,
		title: 'Season One',
		episodes: [episode(11, 1, 'Pilot')],
	},
	{
		id: 2,
		season_number: 2,
		title: 'Season Two',
		episodes: [episode(21, 2, 'Return')],
	},
	{
		id: 3,
		season_number: 3,
		title: 'Season Three',
		episodes: [],
	},
];

function header(extra: Record<string, unknown> = {}) {
	return { data: {
		id: '9',
		title: 'Example Show',
		link: '/tv/9',
		type: 'tv',
		watchlist: false,
		seasons: SEASONS,
		...extra,
	} };
}

function carousel(
	id: string,
	title: string,
	cards: Array<Record<string, unknown>>,
	properties?: Record<string, string>,
) {
	return {
		id,
		component: 'NMCarousel',
		props: {
			id,
			title,
			properties,
			items: cards.map((data) => ({
				id: String(data.id),
				component: 'NMCard',
				props: { id: String(data.id), data },
			})),
		},
	};
}

const SERVER_ROWS = {
	data: [{
		id: 'info-tv-9',
		component: 'NMLolomo',
		props: {
			id: 'info-tv-9',
			hero: 'none',
			items: [
				carousel('info-seasons-1', '1 - Season One', [{
					id: 'a1',
					title: '1. Server Pilot',
					type: 'episode',
					backdrop: '/s1.jpg',
					link: '/tv/9/watch?season=1&episode=1',
				}], { rowType: 'seasons', season_number: '1' }),
				carousel('info-seasons-2', '2 - Season Two', [{
					id: 'a2',
					title: '1. Server Return',
					type: 'episode',
					backdrop: '/s2.jpg',
					link: '/tv/9/watch?season=2&episode=1',
				}], { rowType: 'seasons', season_number: '2' }),
				carousel('info-cast', 'Cast', [{
					id: 'p1',
					title: 'Example Actor',
					type: 'person',
					link: '/person/1',
				}]),
			],
		},
	}],
};

let wrapper: VueWrapper;

async function boot(rowsAnswer: unknown, extra: Record<string, unknown> = {}): Promise<void> {
	apiFetch.mockImplementation(({ path }: { path: string }) =>
		Promise.resolve(path.includes('version=lolomo')
			? rowsAnswer
			: header(extra)));

	const router = createRouter({ history: createWebHistory(), routes: [] });

	wrapper = mount(InfoScreen, {
		props: { type: 'tv', id: '9' },
		attachTo: document.body,
		global: { plugins: [VueQueryPlugin, router] },
	});

	await vi.waitFor(() => expect(document.querySelector('.nm-pill')).not.toBeNull());
	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

const chip = (): HTMLElement | null => document.querySelector<HTMLElement>('.season-chip');
const captions = (): string[] => Array.from(document.querySelectorAll('.info-seasons .caption-title')).map((n) => n.textContent?.trim() ?? '');

async function pickSeason(index: number): Promise<void> {
	chip()!.click();
	await flushPromises();
	document.querySelectorAll<HTMLElement>('.season-overlay .season-row')[index]!.click();
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
	apiFetch.mockReset();
	vi.restoreAllMocks();
});

describe('info rows: the server components with a fallback for older servers', () => {
	it('a server that honors version=lolomo draws its rows, the chip picks the row by season_number', async () => {
		await boot(SERVER_ROWS);

		expect(apiFetch.mock.calls.some((c) => (c[0] as { path: string }).path === '/api/v1/tv/9?version=lolomo')).toBe(true);
		expect(captions()).toContain('1. Server Pilot');
		expect(captions()).not.toContain('1. Pilot');
		expect(document.querySelector('.info-seasons')?.textContent).toContain('Cast');

		await pickSeason(1);
		expect(captions()).toContain('1. Server Return');
	});

	it('an older server that answers the info object gets the client-built rows', async () => {
		await boot(header());

		expect(chip()?.textContent?.trim()).toBe('1 - Season One');
		expect(captions()).toContain('1. Pilot');
	});

	it('infoComponentMapping.kt:47-52: a collection row replaces the seasons rail', async () => {
		await boot(header(), { collection: [{
			id: 5,
			title: 'Example Film',
			link: '/movie/5',
			media_type: 'movie',
		}] });

		expect(chip()).toBeNull();
		expect(captions()).not.toContain('1. Pilot');
		expect(document.querySelector('.info-seasons')?.textContent).toContain('Collections');
	});

	it('infoComponentMapping.kt:55: a season without episodes draws no chip and no rail', async () => {
		await boot(header());
		await pickSeason(2);

		expect(chip()).toBeNull();
		expect(document.querySelectorAll('.info-seasons .rail-track > [data-focusable]')).toHaveLength(0);
	});
});
