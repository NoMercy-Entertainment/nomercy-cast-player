import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import { mountEpisodeScreen } from '@/players/video/pluginPanels/EpisodeScreen';
import { mountLanguageScreen } from '@/players/video/pluginPanels/LanguageScreen';
import { mountPreScreen } from '@/players/video/pluginPanels/PreScreen';
import { mountSeekContainer } from '@/players/video/pluginPanels/SeekContainer';

const back = vi.fn();
const router = { back, currentRoute: { value: { path: '/watch/1' } } };

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
