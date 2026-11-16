import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import { mountEpisodeScreen } from '@/players/video/pluginPanels/EpisodeScreen';
import { mountLanguageScreen } from '@/players/video/pluginPanels/LanguageScreen';
import { mountPreScreen } from '@/players/video/pluginPanels/PreScreen';
import { mountSeekContainer } from '@/players/video/pluginPanels/SeekContainer';
import { TVOverlayPlugin } from '@/players/video/TVOverlayPlugin';

const back = vi.fn();
const router = { back, replace: vi.fn(), currentRoute: { value: { path: '/watch/1' } } };
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
	target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('back keys with a player panel open', () => {
	let host: VueWrapper;
	let parent: HTMLElement;
	const onExit = vi.fn();

	beforeEach(() => {
		// jsdom has no layout, so it has no scrollIntoView.
		Element.prototype.scrollIntoView = vi.fn();
		back.mockClear();
		onExit.mockClear();
		parent = document.createElement('div');
		document.body.append(parent);
		host = mount(Host);
	});

	afterEach(() => {
		host.unmount();
		parent.remove();
	});

	const panels: Array<[string, () => () => void]> = [
		['language', () => mountLanguageScreen({
			parent,
			audioTracks: [{ id: 1, label: 'Track A' }],
			subtitleTracks: [],
			onPickAudio: () => {},
			onPickSubtitle: () => {},
			onExit,
		} as never)],
		['episode', () => mountEpisodeScreen({
			parent,
			episodes: [{ id: 1, title: 'Episode A', season: 1, episode: 1 }],
			onPick: () => {},
			onExit,
		} as never)],
		['pre', () => mountPreScreen({
			parent,
			title: 'Title A',
			showEpisodes: false,
			showLanguages: false,
			onPlay: () => {},
			onRestart: () => {},
			onShowEpisodes: () => {},
			onShowLanguages: () => {},
			onExit,
		})],
		['seek', () => mountSeekContainer({
			parent,
			getCurrentTime: () => 10,
			getDuration: () => 100,
			onCommit: () => {},
			onCancel: onExit,
		})],
	];

	for (const [name, mountPanel] of panels) {
		for (const key of ['Escape', 'Back', 'GoBack']) {
			it(`${key} closes the ${name} panel and stays on the route`, () => {
				const unmount = mountPanel();
				try {
					pressBack(key);
					expect(onExit).toHaveBeenCalledTimes(1);
					expect(back).not.toHaveBeenCalled();
				}
				finally {
					unmount();
				}
			});
		}
	}

	it('leaves the route on Escape when no panel is open', () => {
		pressBack('Escape');
		expect(back).toHaveBeenCalledTimes(1);
	});
});

// The 2.x player has no overlay element, only the container it mounts into.
function fakePlayer() {
	const container = document.createElement('div');
	document.body.append(container);
	return {
		container,
		on: vi.fn(),
		off: vi.fn(),
		play: vi.fn(),
		pause: vi.fn(),
		time: vi.fn(() => 0),
		duration: vi.fn(() => 0),
		subtitles: vi.fn(() => []),
		audioTracks: vi.fn(() => []),
		qualityLevels: vi.fn(() => []),
		chapters: vi.fn(() => []),
	};
}

describe('back keys while the video plays with no panel open', () => {
	let host: VueWrapper;
	let player: ReturnType<typeof fakePlayer>;
	let overlay: TVOverlayPlugin;

	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
		back.mockClear();
		host = mount(Host);
		player = fakePlayer();
		// Same wiring as VideoPlayer.vue: leaving the watch screen is router.back().
		overlay = new TVOverlayPlugin(player as never, { skipPreScreen: true, onExit: () => router.back() });
		overlay.attach();
	});

	afterEach(() => {
		overlay.detach();
		player.container.remove();
		host.unmount();
	});

	for (const key of ['Escape', 'Back', 'GoBack', 'BrowserBack']) {
		it(`${key} pauses on the pre-screen and keeps the route; a second ${key} leaves`, () => {
			expect(document.querySelector('.pre-screen')).toBeNull();

			pressBack(key);
			expect(back).not.toHaveBeenCalled();
			expect(player.pause).toHaveBeenCalledTimes(1);
			expect(document.querySelector('.pre-screen')).not.toBeNull();

			pressBack(key);
			expect(back).toHaveBeenCalledTimes(1);
		});
	}

	it('leaves the route on Escape once the player is gone', () => {
		overlay.detach();
		pressBack('Escape');
		expect(back).toHaveBeenCalledTimes(1);
		expect(player.pause).not.toHaveBeenCalled();
	});
});
