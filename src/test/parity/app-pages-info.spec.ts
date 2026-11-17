import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';
import { decls } from '../cssDecl';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

Element.prototype.scrollIntoView = vi.fn();

const { default: InfoScreen } = await import('@/views/info/InfoScreen.vue');

function episode(id: number, season: number) {
	return {
		id,
		episode_number: 1,
		season_number: season,
		title: `Episode ${id}`,
		still: null,
		link: `/tv/9/watch?season=${season}&episode=1`,
	};
}

const SPECIALS_FIRST = [
	{
		id: 10,
		season_number: 0,
		title: 'Specials',
		episodes: [episode(1, 0)],
	},
	{
		id: 11,
		season_number: 1,
		title: 'Season One',
		episodes: [episode(2, 1)],
	},
	{
		id: 12,
		season_number: 2,
		title: 'Season Two',
		episodes: [episode(3, 2)],
	},
];

let wrapper: VueWrapper;

async function boot(seasons: unknown[], extra: Record<string, unknown> = {}): Promise<void> {
	apiFetch.mockResolvedValue({
		data: {
			id: '9',
			title: 'Example Show',
			link: '/tv/9',
			type: 'tv',
			watchlist: false,
			seasons,
			...extra,
		},
	});

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
}

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
	apiFetch.mockReset();
});

describe('row 5: info page matches InfoScreen.kt and LinkButton.kt', () => {
	it('the hero is the title only: no year, length and rating line (VideoMusicHeroSection.kt:36-44)', async () => {
		await boot([], {
			year: 2001,
			duration: 5400,
			voteAverage: 7.5,
			overview: 'Example overview.',
		});

		expect(document.querySelector('.meta-row')).toBeNull();
		expect(document.querySelector('.nm-hero-overview')?.getAttribute('style') ?? '').not.toContain('line-clamp');
	});

	it('opens season 1 when a Specials season 0 comes first (InfoScreen.kt:167-172)', async () => {
		await boot(SPECIALS_FIRST);
		expect(document.querySelector('.season-chip')?.textContent?.trim()).toBe('1 - Season One');
	});

	it('a single season is titled "N - title" (InfoComponentMapping.kt:56-62)', async () => {
		await boot([SPECIALS_FIRST[1]]);
		expect(document.querySelector('.season-chip')).toBeNull();
		expect(document.querySelector('.info-seasons .rail-header h2')?.textContent?.trim()).toBe('1 - Season One');
	});

	it('button icons are 24 (LinkButton.kt:168-172)', async () => {
		await boot([]);
		const icons = Array.from(document.querySelectorAll('.actions .nm-pill svg'));

		expect(icons.length).toBeGreaterThan(0);
		expect(icons.every((s) => s.getAttribute('width') === '24' && s.getAttribute('height') === '24')).toBe(true);
	});

	it('button text is weight 400 with spacing 0.5 (LinkButton.kt:57-58,177-186)', () => {
		const p = decls('styles/components.css', '.nm-pill');

		expect(p['font-weight']).toBe('400');
		expect(p['letter-spacing']).toBe('0.5px');
	});

	it('focus: fill is black at 6 %, text at 90 %, padding keeps the text still (LinkButton.kt:92-106,149)', () => {
		for (const sel of ['.nm-pill-primary:focus-visible', '.nm-pill-secondary:focus-visible']) {
			const f = decls('styles/components.css', sel);

			expect(f.background).toBe('rgba(0, 0, 0, 0.06)');
			expect(f.color).toBe('rgba(255, 255, 255, 0.9)');
			expect(f.padding).toBe('0 10px');
		}
	});

	it('season chip is exactly one wide card wide (TvHomeAdapter.kt chip block)', () => {
		expect(decls('views/info/InfoSeasons.vue', '.season-chip').width).toBe('calc((100vw - 40px - 42px - 24px) / 3)');
	});
});
