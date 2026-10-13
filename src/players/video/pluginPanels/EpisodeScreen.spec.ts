import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountEpisodeScreen } from './EpisodeScreen';
import type { EpisodeItem } from './EpisodeScreen';

const episodes: EpisodeItem[] = [
	{ id: 1, season: 1, episode: 1, title: 'One' },
	{ id: 2, season: 1, episode: 2, title: 'Two' },
	{ id: 3, season: 2, episode: 1, title: 'Three' },
];

describe('the episode picker keeps focus where the D-pad put it', () => {
	let unmount: (() => void) | undefined;

	// jsdom has no layout, so it has no scrollIntoView.
	Element.prototype.scrollIntoView = vi.fn();

	afterEach(() => {
		unmount?.();
		document.body.innerHTML = '';
	});

	function mount(): HTMLElement {
		unmount = mountEpisodeScreen({
			parent: document.body,
			episodes,
			currentId: 1,
			onPick: vi.fn(),
			onExit: vi.fn(),
		});
		return document.body;
	}

	it('keeps focus on a season button while the episode list follows it', () => {
		const root = mount();
		const season2 = root.querySelector<HTMLElement>('[data-season-number="2"]')!;

		season2.focus();

		expect(document.activeElement).toBe(season2);
		expect(root.querySelectorAll('.episode-card')).toHaveLength(1);
	});

	it('moves focus into the episodes on ArrowRight', () => {
		const root = mount();
		const season2 = root.querySelector<HTMLElement>('[data-season-number="2"]')!;
		season2.focus();

		season2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

		expect(document.activeElement?.closest('.episode-list')).not.toBeNull();
	});
});
