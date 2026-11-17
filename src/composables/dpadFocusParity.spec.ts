import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import HeroRailsView from '@/views/HeroRailsView.vue';
import TopNavBar from '@/layout/TopNavBar.vue';
import type { Component } from '@/server-components/types';
import { decls } from '@/test/cssDecl';

const route = vi.hoisted(() => ({ path: '/' }));
const back = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock('vue-router', () => ({
	useRoute: () => route,
	useRouter: () => ({
		push,
		back,
		replace: vi.fn(),
		currentRoute: { value: route },
	}),
}));

vi.mock('@/queries/useMeQuery', () => ({
	useMeQuery: () => ({ data: { value: { name: 'Jordan', email: 'jordan@example.com' } } }),
}));

Element.prototype.scrollIntoView = vi.fn();

function album(id: string): Component {
	return {
		id,
		component: 'NMMusicCard',
		props: { id, data: {
			id,
			title: id,
			type: 'album',
			link: `/music/album/${id}`,
			cover: null,
		} },
	} as unknown as Component;
}

function rail(id: string, count: number) {
	return {
		id,
		component: 'NMCarousel',
		props: {
			id,
			title: id,
			items: Array.from({ length: count }, (_, i) =>
				album(`${id}-${i}`)),
		},
	} as const satisfies Component;
}

const Host = defineComponent({
	props: { rails: { type: Array, required: true } },
	setup(props) {
		useDPad({
			back,
			replace: vi.fn(),
			currentRoute: { value: route },
		} as never);

		return () => h('div', [h(TopNavBar), h(HeroRailsView, {
			restorationKey: 'dpad-focus-parity',
			data: props.rails as Component[],
			isLoading: false,
			refetch: vi.fn(),
			errorContext: 'x',
			emptyMessage: 'x',
		})]);
	},
});

function press(key: string, repeat = false): KeyboardEvent {
	const event = new KeyboardEvent('keydown', {
		key,
		repeat,
		bubbles: true,
		cancelable: true,
	});

	(document.activeElement ?? document.body).dispatchEvent(event);

	return event;
}

function cardsOf(railId: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(`[data-rail-id="${railId}"] .rail-track > [data-focusable]`));
}

let wrapper: VueWrapper;

async function boot(path: string, rails: Component[]): Promise<void> {
	route.path = path;
	wrapper = mount(Host, { props: { rails }, attachTo: document.body });
	await flushPromises();
	await vi.dynamicImportSettled();
	await flushPromises();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	back.mockClear();
	// A page before this one, so leaving goes back.
	window.history.replaceState({ back: '/title' }, '');
});

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
});

describe('back from content goes to the nav first (VideoContentList.kt:519-533, MusicContentList.kt:136-142)', () => {
	it('the first Escape on a card focuses the active nav tab, the second leaves the route', async () => {
		await boot('/libraries', [rail('r1', 4)]);
		cardsOf('r1')[1]!.focus();

		const first = press('Escape');
		const active = document.querySelector<HTMLElement>('.topnav .nav-link.active');

		expect(active).not.toBeNull();
		expect(document.activeElement).toBe(active);
		expect(first.defaultPrevented).toBe(true);
		expect(back).not.toHaveBeenCalled();

		press('Escape');
		expect(back).toHaveBeenCalledTimes(1);
	});

	it('at the root route the first Back on a card also lands on the nav and is consumed', async () => {
		await boot('/', [rail('r1', 4)]);
		cardsOf('r1')[0]!.focus();

		expect(press('Back').defaultPrevented).toBe(true);
		expect(document.activeElement?.closest('.topnav')).not.toBeNull();
	});
});

describe('up from the first row lands on the selected tab (TvNavigationBar.kt:109-131)', () => {
	it('arrow up on the music screen focuses the Music tab, not Home', async () => {
		await boot('/music', [rail('r1', 4)]);
		cardsOf('r1')[0]!.focus();
		press('ArrowUp');

		expect(document.activeElement).toBe(document.querySelector('.topnav .nav-link.active'));
		expect(document.activeElement?.getAttribute('href')).toBe('/music');
	});
});

describe('every edge key is consumed (TvCardViewHolder.kt:358-382, TvRowFocus.kt:123-128)', () => {
	it('left on the first card, right on the last card and down on the last row are prevented', async () => {
		await boot('/', [rail('r1', 4), rail('r2', 4)]);
		const first = cardsOf('r1');

		first[0]!.focus();
		expect(press('ArrowLeft').defaultPrevented).toBe(true);
		first[3]!.focus();
		expect(press('ArrowRight').defaultPrevented).toBe(true);
		cardsOf('r2')[1]!.focus();
		expect(press('ArrowDown').defaultPrevented).toBe(true);
	});
});

describe('down from the nav enters the first card fully in view (TvRowFocus.kt:60-96)', () => {
	it('lands on the first fully visible card of row 0, not on card 0 scrolled away', async () => {
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
			const track = this.closest('.rail-track') as HTMLElement | null;

			if (this.classList.contains('rail-track'))
				return new DOMRect(0, 0, 960, 200);

			if (!track || !this.hasAttribute('data-focusable'))
				return new DOMRect(0, 0, 0, 0);

			const index = Array.from(track.children).indexOf(this);

			return new DOMRect(40 + index * 126 - track.scrollLeft, 0, 118, 177);
		});

		await boot('/', [rail('r1', 10), rail('r2', 10)]);
		document.querySelector<HTMLElement>('[data-rail-id="r1"] .rail-track')!.scrollLeft = 300;
		document.querySelector<HTMLElement>('.topnav .nav-link')!.focus();
		press('ArrowDown');

		expect(document.activeElement).toBe(cardsOf('r1')[3]);
		vi.restoreAllMocks();
	});
});

describe('a focused row anchors to the top of the list (VideoContentList.kt:594-597, 650-661)', () => {
	it('scrolls the row to the block start, under the 8 px list padding', async () => {
		await boot('/', [rail('r1', 4), rail('r2', 4), rail('r3', 4)]);
		cardsOf('r1')[0]!.focus();
		(Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
		press('ArrowDown');

		expect(cardsOf('r2')).toContain(document.activeElement);
		expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ block: 'start' }));
		expect(decls('styles/components.css', '.nm-hero-rails')['scroll-padding-top']).toBe('8px');
	});
});

describe('a held OK acts once (TvNavigationBar.kt:331-336)', () => {
	it('key repeat on a card does not fire the card action again', async () => {
		await boot('/', [rail('r1', 4)]);
		const card = cardsOf('r1')[0]!;

		push.mockClear();
		card.focus();
		press('Enter');
		press('Enter', true);
		press('Enter', true);

		expect(push).toHaveBeenCalledTimes(1);
	});
});
