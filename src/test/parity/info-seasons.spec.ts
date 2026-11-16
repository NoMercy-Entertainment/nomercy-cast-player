import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { useDPad } from '@/composables/useDPad';
import { decls } from '../cssDecl';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

Element.prototype.scrollIntoView = vi.fn();

const { default: InfoScreen } = await import('@/views/info/InfoScreen.vue');

const SEASONS = [
	{
		id: 1,
		season_number: 1,
		title: 'Season One',
		episodes: [
			{ id: 11, episode_number: 1, season_number: 1, title: 'Pilot', still: '/still-1.jpg', link: '/tv/9/watch?season=1&episode=1' },
			{ id: 12, episode_number: 2, season_number: 1, title: 'Second Example', still: null, link: '/tv/9/watch?season=1&episode=2' },
		],
	},
	{
		id: 2,
		season_number: 2,
		title: 'Season Two',
		episodes: [
			{ id: 21, episode_number: 1, season_number: 2, title: 'Return', still: '/still-3.jpg', link: '/tv/9/watch?season=2&episode=1' },
		],
	},
	{ id: 3, season_number: 3, title: 'Season Three', episodes: [] },
];

function info(seasons: unknown[]): unknown {
	return { data: { id: '9', title: 'Example Show', link: '/tv/9', type: 'tv', watchlist: false, seasons } };
}

let wrapper: VueWrapper;

async function boot(seasons: unknown[] = SEASONS): Promise<void> {
	// jsdom draws nothing: a modal group moves by box, so stack the season rows.
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		const index = this.classList.contains('season-row') ? Array.from(this.parentElement!.children).indexOf(this) : 0;
		return new DOMRect(0, index * 50, 300, 40);
	});
	apiFetch.mockResolvedValue(info(seasons));
	const router = createRouter({ history: createWebHistory(), routes: [] });
	const Host = defineComponent({
		setup() {
			useDPad(router);
			return () => h(InfoScreen, { type: 'tv', id: '9' });
		},
	});
	wrapper = mount(Host, { attachTo: document.body, global: { plugins: [VueQueryPlugin, router] } });
	await vi.waitFor(() => expect(document.querySelector('.nm-pill')).not.toBeNull());
	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();
	await new Promise(resolve => setTimeout(resolve, 0));
}

function press(key: string): void {
	(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

const chip = (): HTMLElement | null => document.querySelector<HTMLElement>('.season-chip');
const cards = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.info-seasons .rail-track > [data-focusable]'));
const rows = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.season-overlay .season-row'));

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
	apiFetch.mockReset();
	vi.restoreAllMocks();
});

describe('info.episode-card matches TvHomeAdapter.kt:36-75 / InfoComponentMapping.kt:204-220', () => {
	it('the first season fills a wide rail of episode cards with a caption', async () => {
		await boot();
		expect(cards()).toHaveLength(2);
		expect(cards().every(c => c.classList.contains('card-wide'))).toBe(true);
		expect(cards()[0].querySelector('.caption-title')?.textContent?.trim()).toBe('1. Pilot');
		expect(cards()[0].querySelector('.caption-title-2')).not.toBeNull();
	});

	it('wide card: 16:9, three whole cards and a 42 px peek (:68-75)', () => {
		const f = 'server-components/NMCard.vue';
		expect(decls(f, '.card-wide').width).toBe('calc((100vw - 40px - 42px - 24px) / 3)');
		expect(decls(f, '.card-wide').flex).toBe('0 0 calc((100vw - 40px - 42px - 24px) / 3)');
		expect(decls(f, '.card-wide .poster')['aspect-ratio']).toBe('16 / 9');
	});

	it('a show with one empty season or none draws no rail', async () => {
		await boot([]);
		expect(chip()).toBeNull();
		expect(cards()).toHaveLength(0);
	});
});

describe('info.season-picker matches TvHomeAdapter.kt:395-420,449-473', () => {
	it('the chip names the selected season and is a D-pad entry', async () => {
		await boot();
		expect(chip()?.textContent?.trim()).toBe('1 - Season One');
		expect(chip()?.hasAttribute('data-focusable')).toBe(true);
		expect(chip()?.querySelector('svg')).not.toBeNull();
	});

	it('a show with one season has no chip', async () => {
		await boot([SEASONS[0]]);
		expect(chip()).toBeNull();
		expect(cards()).toHaveLength(2);
	});

	it('chip: h38, one card wide, start 40, bottom 12, r12, 1 px white .18, 14 Medium, chevron 20', () => {
		const f = 'views/info/InfoSeasons.vue';
		const c = decls(f, '.season-chip');
		expect(c.height).toBe('38px');
		expect(c.width).toBe('calc((100vw - 40px - 42px - 24px) / 3 + 8px)');
		expect(c.margin).toBe('0 0 12px 40px');
		expect(c['border-radius']).toBe('12px');
		expect(c.border).toBe('1px solid rgba(255, 255, 255, 0.18)');
		expect(c['font-size']).toBe('14px');
		expect(c['font-weight']).toBe('500');
		expect(decls(f, '.season-chip:focus-visible').border).toBe('3px solid rgba(255, 255, 255, 0.85)');
		expect(decls(f, '.season-chip svg').width).toBe('20px');
	});

	it('d-pad: DOWN from the last button reaches the chip, DOWN again the first card, UP returns', async () => {
		await boot();
		const buttons = Array.from(document.querySelectorAll<HTMLElement>('.actions [data-focusable]'));
		buttons[buttons.length - 1].focus();
		press('ArrowDown');
		expect(document.activeElement).toBe(chip());
		press('ArrowDown');
		expect(document.activeElement).toBe(cards()[0]);
		press('ArrowUp');
		expect(document.activeElement).toBe(chip());
	});

	it('d-pad: RIGHT from the chip enters the cards (:513-523)', async () => {
		await boot();
		chip()!.focus();
		press('ArrowRight');
		expect(document.activeElement).toBe(cards()[0]);
	});
});

describe('info.season-picker.overlay matches TvSeasonPickerOverlay.kt:74-156', () => {
	it('pressing OK on the chip opens the overlay with focus on the selected season', async () => {
		await boot();
		chip()!.focus();
		press('Enter');
		await flushPromises();
		expect(rows().map(r => r.textContent?.trim())).toEqual(['1 - Season One', '2 - Season Two', '3 - Season Three']);
		expect(document.activeElement).toBe(rows()[0]);
		expect(rows()[0].getAttribute('aria-selected')).toBe('true');
	});

	it('pressing DOWN moves between rows and stays inside the panel', async () => {
		await boot();
		chip()!.focus();
		press('Enter');
		await flushPromises();
		press('ArrowDown');
		expect(document.activeElement).toBe(rows()[1]);
		press('ArrowDown');
		press('ArrowDown');
		expect(document.activeElement).toBe(rows()[2]);
	});

	it('pressing OK on a row selects it, closes the panel, swaps the episodes and returns focus to the chip', async () => {
		await boot();
		chip()!.focus();
		press('Enter');
		await flushPromises();
		press('ArrowDown');
		press('Enter');
		await flushPromises();
		expect(document.querySelector('.season-overlay')).toBeNull();
		expect(chip()?.textContent?.trim()).toBe('2 - Season Two');
		expect(cards()).toHaveLength(1);
		expect(cards()[0].querySelector('.caption-title')?.textContent?.trim()).toBe('1. Return');
		expect(document.activeElement).toBe(chip());
	});

	it('pressing Back closes the panel and keeps the season', async () => {
		await boot();
		chip()!.focus();
		press('Enter');
		await flushPromises();
		press('Escape');
		await flushPromises();
		expect(document.querySelector('.season-overlay')).toBeNull();
		expect(chip()?.textContent?.trim()).toBe('1 - Season One');
		expect(document.activeElement).toBe(chip());
	});

	it('panel: 360 wide, max 520 high, r12, #1A1A1A, border white .14, pad 6, gap 4, scrim black .55', () => {
		const f = 'views/info/SeasonPickerOverlay.vue';
		expect(decls(f, '.season-scrim').background).toBe('rgba(0, 0, 0, 0.55)');
		const p = decls(f, '.season-panel');
		expect(p.width).toBe('360px');
		expect(p['max-height']).toBe('520px');
		expect(p['border-radius']).toBe('12px');
		expect(p.background).toBe('#1a1a1a');
		expect(p.border).toBe('1px solid rgba(255, 255, 255, 0.14)');
		expect(p.padding).toBe('6px');
		expect(p.gap).toBe('4px');
		expect(p['margin-left']).toBe('40px');
		expect(p['margin-top']).toBe('var(--hero-height)');
	});

	it('row: r8, pad 12/14, 15 px, border white .35 selected and white .85 2 px focused, bg white .08', () => {
		const f = 'views/info/SeasonPickerOverlay.vue';
		const r = decls(f, '.season-row');
		expect(r['border-radius']).toBe('8px');
		expect(r.padding).toBe('12px 14px');
		expect(r['font-size']).toBe('15px');
		expect(r.border).toBe('1px solid transparent');
		const selected = '.season-row[aria-selected=\'true\']';
		expect(decls(f, selected)['border-color']).toBe('rgba(255, 255, 255, 0.35)');
		expect(decls(f, selected)['font-weight']).toBe('600');
		const focus = decls(f, '.season-row:focus-visible');
		expect(focus.border).toBe('2px solid rgba(255, 255, 255, 0.85)');
		expect(focus.background).toBe('rgba(255, 255, 255, 0.08)');
	});
});
