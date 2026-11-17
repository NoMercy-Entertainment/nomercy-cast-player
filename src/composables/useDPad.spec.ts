import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { EventEmitter, LifecycleRegistry } from '@nomercy-entertainment/nomercy-player-core';

import { useDPad } from '@/composables/useDPad';
import { TvUiPlugin } from '@/players/video/plugins/tv-ui';

const back = vi.fn();
const router = {
	back,
	replace: vi.fn(),
	currentRoute: { value: { path: '/watch/1' } },
};

// A page before this one in the receiver, so leaving goes back.
window.history.replaceState({ back: '/title' }, '');

const Host = defineComponent({
	setup() {
		useDPad(router as never);

		return () => h('div');
	},
});

function pressBack(key: string): void {
	const target = document.querySelector<HTMLElement>('[data-focusable], button') ?? document.body;

	target.focus();

	target.dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

interface Item {
	id: number;
	title: string;
	season: number;
	episode: number;
}

class FakePlayer extends EventEmitter<Record<string, unknown>> {
	container = document.createElement('div');
	state = 'playing';
	items: Item[] = [
		{
			id: 1,
			title: 'One',
			season: 1,
			episode: 1,
		},
		{
			id: 2,
			title: 'Two',
			season: 1,
			episode: 2,
		},
	];

	playState = (): string => this.state;
	time = (): number => 10;
	duration = (): number => 100;
	queue = (): Item[] => this.items;
	item = (): Item => this.items[0]!;
	index = (): number => 0;
	play = vi.fn<() => Promise<void>>(async () => {
		this.state = 'playing';
	});

	pause = vi.fn<() => Promise<void>>(async () => {
		this.state = 'paused';
	});

	restart = vi.fn<() => void>();
}

const registries: LifecycleRegistry[] = [];

function startOverlay(player: FakePlayer, skipPreScreen: boolean, onExit: () => void): TvUiPlugin {
	const plugin = new TvUiPlugin();
	const lifecycle = new LifecycleRegistry();

	registries.push(lifecycle);
	plugin.initialize(player as never, { skipPreScreen, onExit }, lifecycle);
	plugin.use();

	return plugin;
}

function clickButton(label: string): void {
	const buttons = Array.from(document.querySelectorAll<HTMLElement>('.tvui-pre-buttons .tvui-button'));

	buttons.find((button) => button.textContent === label)!.click();
}

describe('back keys with a tv-ui panel open', () => {
	let host: VueWrapper;
	let player: FakePlayer;
	const onExit = vi.fn();

	beforeEach(() => {
		// jsdom has no layout, so it has no scrollIntoView.
		Element.prototype.scrollIntoView = vi.fn();
		back.mockClear();
		onExit.mockClear();
		host = mount(Host);
		player = new FakePlayer();
		document.body.append(player.container);
	});

	afterEach(() => {
		registries.splice(0).forEach((registry) => registry.dispose());
		player.container.remove();
		host.unmount();
	});

	const dialogs: Array<[string, string, string]> = [
		['language', '.tvui-languages', 'Audio and Subtitles'],
		['episode', '.tvui-episodes', 'Episodes'],
	];

	for (const [name, selector, opener] of dialogs) {
		for (const key of ['Escape', 'Back', 'GoBack']) {
			it(`${key} closes the ${name} dialog back to the pre-screen and stays on the route`, () => {
				startOverlay(player, false, onExit);
				clickButton(opener);
				expect(document.querySelector(selector)).not.toBeNull();

				pressBack(key);
				expect(document.querySelector(selector)).toBeNull();
				expect(document.querySelector('.tvui-pre-screen')).not.toBeNull();
				expect(back).not.toHaveBeenCalled();
				expect(onExit).not.toHaveBeenCalled();
			});
		}
	}

	for (const key of ['Escape', 'Back', 'GoBack']) {
		it(`${key} on the pre-screen hands the exit to the player, not to the router`, () => {
			startOverlay(player, false, onExit);
			pressBack(key);
			expect(onExit).toHaveBeenCalledTimes(1);
			expect(back).not.toHaveBeenCalled();
		});
	}

	it('back cancels the seek strip and stays on the route', () => {
		startOverlay(player, true, onExit);

		window.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'ArrowRight',
			bubbles: true,
			cancelable: true,
		}));

		expect(document.querySelector('.tvui-seek-strip')).not.toBeNull();
		pressBack('Escape');
		expect(document.querySelector('.tvui-seek-strip')).toBeNull();
		expect(back).not.toHaveBeenCalled();
		expect(onExit).not.toHaveBeenCalled();
	});

	it('leaves the route on Escape once the player is gone', () => {
		pressBack('Escape');
		expect(back).toHaveBeenCalledTimes(1);
	});
});

describe('back keys while the video plays with no panel open', () => {
	let host: VueWrapper;
	let player: FakePlayer;

	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
		back.mockClear();
		host = mount(Host);
		player = new FakePlayer();
		document.body.append(player.container);

		// Same wiring as VideoPlayer.vue: leaving the watch screen is router.back().
		startOverlay(player, true, () =>
			router.back());
	});

	afterEach(() => {
		registries.splice(0).forEach((registry) => registry.dispose());
		player.container.remove();
		host.unmount();
	});

	for (const key of ['Escape', 'Back', 'GoBack', 'BrowserBack']) {
		it(`${key} pauses on the pre-screen and keeps the route; a second ${key} leaves`, () => {
			expect(document.querySelector('.tvui-pre-screen')).toBeNull();

			pressBack(key);
			expect(back).not.toHaveBeenCalled();
			expect(player.pause).toHaveBeenCalledTimes(1);
			expect(document.querySelector('.tvui-pre-screen')).not.toBeNull();

			pressBack(key);
			expect(back).toHaveBeenCalledTimes(1);
		});
	}

	it('leaves the route on Escape once the player is gone', () => {
		registries.splice(0).forEach((registry) => registry.dispose());
		pressBack('Escape');
		expect(back).toHaveBeenCalledTimes(1);
		expect(player.pause).not.toHaveBeenCalled();
	});
});

describe('one Enter or arrow with a tv-ui panel open', () => {
	let host: VueWrapper;
	let player: FakePlayer;

	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
		host = mount(Host);
		player = new FakePlayer();
		document.body.append(player.container);
		startOverlay(player, false, vi.fn());
		clickButton('Audio and Subtitles');
	});

	afterEach(() => {
		registries.splice(0).forEach((registry) => registry.dispose());
		player.container.remove();
		host.unmount();
	});

	it('activates the focused row once, not once per handler', () => {
		const clicks: string[] = [];

		const count = (event: Event): void => {
			clicks.push((event.target as HTMLElement).className);
		};

		document.addEventListener('click', count, true);

		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true,
		}));

		document.removeEventListener('click', count, true);

		expect(clicks).toHaveLength(1);
	});
});
