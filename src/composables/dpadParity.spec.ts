import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import HeroRailsView from '@/views/HeroRailsView.vue';
import TopNavBar from '@/layout/TopNavBar.vue';
import type { Component } from '@/server-components/types';
import { decls } from '@/test/cssDecl';

const push = vi.hoisted(() => vi.fn());

vi.mock('vue-router', () => ({
	useRoute: () => ({ path: '/', params: {} }),
	useRouter: () => ({
		push,
		back: vi.fn(),
		replace: vi.fn(),
		currentRoute: { value: { path: '/' } },
	}),
}));

vi.mock('@/queries/useMeQuery', () => ({
	useMeQuery: () => ({ data: ref({ name: 'Jordan', email: 'jordan@example.com' }) }),
}));

const scrollIntoView = vi.fn();

Element.prototype.scrollIntoView = scrollIntoView;

const CARD_WIDTH = 118;
const CARD_PITCH = 126;

// jsdom draws nothing: give every rail card a box that follows its track's scroll.
function layOutRails(): void {
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		const track = this.closest('.rail-track') as HTMLElement | null;

		if (this.classList.contains('rail-track'))
			return new DOMRect(0, 0, 960, 200);

		if (!track || !this.hasAttribute('data-focusable'))
			return new DOMRect(0, 0, 0, 0);

		const index = Array.from(track.children).indexOf(this);

		return new DOMRect(40 + index * CARD_PITCH - track.scrollLeft, 0, CARD_WIDTH, 177);
	});
}

function album(id: string): Component {
	return {
		id,
		component: 'NMMusicCard',
		props: { id, data: {
			id,
			title: id,
			type: 'album',
			cover: null,
		} },
	} as unknown as Component;
}

function rail(id: string, count: number) {
	const items = Array.from({ length: count }, (_, i) =>
		album(`${id}-${i}`));

	return {
		id,
		component: 'NMCarousel',
		props: {
			id,
			title: id,
			items,
		},
	} as const satisfies Component;
}

const Host = defineComponent({
	props: { rails: { type: Array, required: true } },
	setup(props) {
		useDPad({
			back: vi.fn(),
			replace: vi.fn(),
			currentRoute: { value: { path: '/' } },
		} as never);

		return () => h('div', [h(TopNavBar), h(HeroRailsView, {
			restorationKey: 'dpad-parity',
			data: props.rails as Component[],
			isLoading: false,
			refetch: vi.fn(),
			errorContext: 'x',
			emptyMessage: 'x',
		})]);
	},
});

function press(key: string): void {
	(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

function cardIds(): string[] {
	return Array.from(document.querySelectorAll<HTMLElement>('.rail-track [data-focusable]')).map((el) => el.dataset.cardId ?? el.id);
}

function focusedLabel(): string {
	const el = document.activeElement as HTMLElement | null;

	return el?.getAttribute('aria-label') ?? el?.dataset.focusKey ?? el?.textContent?.trim() ?? '';
}

let wrapper: VueWrapper;

async function boot(rails: Component[]): Promise<void> {
	layOutRails();
	wrapper = mount(Host, { props: { rails }, attachTo: document.body });
	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function cardsOf(railId: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-rail-id="${railId}"] .rail-track > [data-focusable]`));
}

beforeEach(() => scrollIntoView.mockClear());

afterEach(() => {
	wrapper?.unmount();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('d-pad on the rails matches TvCardViewHolder.kt and TvRowFocus.kt', () => {
	it('dpad.card.ends: LEFT on the first card and RIGHT on the last card keep focus (:358-382)', async () => {
		await boot([rail('r1', 4), rail('r2', 4)]);
		const cards = cardsOf('r1');

		expect(cards.length).toBe(4);
		cards[0].focus();
		press('ArrowLeft');
		expect(document.activeElement).toBe(cards[0]);
		cards[3].focus();
		press('ArrowRight');
		expect(document.activeElement).toBe(cards[3]);
	});

	it('dpad.card.up-down: DOWN on the last row keeps focus (:399-420)', async () => {
		await boot([rail('r1', 4), rail('r2', 4)]);
		const last = cardsOf('r2');

		last[1].focus();
		press('ArrowDown');
		expect(document.activeElement).toBe(last[1]);
	});

	it('dpad.card.up-down: DOWN moves to the row below', async () => {
		await boot([rail('r1', 4), rail('r2', 4)]);
		cardsOf('r1')[1].focus();
		press('ArrowDown');
		expect(cardsOf('r2')).toContain(document.activeElement);
	});

	it('dpad.row.target-card: a row change lands on the first completely visible card of the row (TvRowFocus.kt)', async () => {
		await boot([rail('r1', 10), rail('r2', 10)]);
		const track = document.querySelector<HTMLElement>('[data-rail-id="r2"] .rail-track')!;

		track.scrollLeft = 300;
		cardsOf('r1')[5].focus();
		press('ArrowDown');
		const row2 = cardsOf('r2');
		const expected = row2.findIndex((el) => el.getBoundingClientRect().left >= 0);

		expect(expected).toBeGreaterThan(0);
		expect(document.activeElement).toBe(row2[expected]);
	});

	it('dpad.card.left-right: the focused card scrolls to the row start (TvCardViewHolder.kt:355-397)', async () => {
		await boot([rail('r1', 10)]);
		const cards = cardsOf('r1');

		cards[0].focus();
		scrollIntoView.mockClear();
		press('ArrowRight');
		expect(cards.indexOf(document.activeElement as HTMLElement)).toBe(1);
		expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ inline: 'start' }));
	});
});

it('dpad.card.left-right: the rail aligns a focused card at its 40 px start inset', () => {
	expect(decls('components/rails/HorizontalRail.vue', '.rail-track')['scroll-padding-inline']).toBe('40px');
});

describe('d-pad on the top nav matches TvNavigationBar.kt', () => {
	it('dpad.nav.left-end: LEFT on Home keeps focus (:193-201)', async () => {
		await boot([rail('r1', 4)]);
		const home = document.querySelector<HTMLElement>('.nav-link')!;

		home.focus();
		press('ArrowLeft');
		expect(document.activeElement).toBe(home);
	});

	it('dpad.nav.right-end: RIGHT on the last nav item goes to the profile, RIGHT there stops, LEFT goes back (:202-205, :251-256)', async () => {
		await boot([rail('r1', 4)]);
		const links = Array.from(document.querySelectorAll<HTMLElement>('.nav-link'));
		const profile = document.querySelector<HTMLElement>('.profile-chip')!;

		links[links.length - 1].focus();
		press('ArrowRight');
		expect(document.activeElement).toBe(profile);
		press('ArrowRight');
		expect(document.activeElement).toBe(profile);
		press('ArrowLeft');
		expect(document.activeElement).toBe(links[links.length - 1]);
	});

	it('dpad.nav.ok: OK on a nav item navigates on the first press, never on key repeat (:331-336, :409-410)', async () => {
		await boot([rail('r1', 4)]);
		push.mockClear();
		document.querySelector<HTMLElement>('.nav-link')!.focus();

		const down = (repeat: boolean): void => {
			document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {
				key: 'Enter',
				repeat,
				bubbles: true,
				cancelable: true,
			}));
		};

		down(true);
		down(true);
		expect(push).not.toHaveBeenCalled();
		down(false);
		expect(push).toHaveBeenCalledTimes(1);
	});

	it('dpad.nav.down: DOWN from a nav item focuses the first card of the first rail', async () => {
		await boot([rail('r1', 4), rail('r2', 4)]);
		document.querySelector<HTMLElement>('.nav-link')!.focus();
		press('ArrowDown');
		expect(document.activeElement).toBe(cardsOf('r1')[0]);
	});

	it('dpad.card.up-down: UP from the first row reaches the top nav (TvRowFocus.kt)', async () => {
		await boot([rail('r1', 4)]);
		cardsOf('r1')[0].focus();
		press('ArrowUp');
		expect(document.activeElement?.closest('.topnav')).not.toBeNull();
	});
});

describe('d-pad memory and first focus', () => {
	it('dpad.initial: the first paint focuses the first card of the first row', async () => {
		await boot([rail('r1', 4), rail('r2', 4)]);
		expect(document.activeElement).toBe(cardsOf('r1')[0]);
		expect(cardIds().length).toBe(8);
		expect(focusedLabel()).not.toBe('');
	});
});
