import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { focusedCardStore } from './focusedCardStore';

// HeroSelectionTiming.kt:33,40-43: a change shows at once, then holds for 1400 ms; only the newest card follows.
describe('the hero is paced like the native hero', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		focusedCardStore.seed(null);
		focusedCardStore.setNavDirection('horizontal');
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function focus(id: string): Promise<void> {
		focusedCardStore.setActive({ id, title: id });
		await nextTick();
	}

	it('shows card A, skips B and shows C when the hold ends', async () => {
		await vi.advanceTimersByTimeAsync(1500);
		await focus('A');
		await vi.advanceTimersByTimeAsync(250);

		expect(focusedCardStore.debouncedCard.value?.id).toBe('A');

		await vi.advanceTimersByTimeAsync(50);
		await focus('B');
		await vi.advanceTimersByTimeAsync(300);
		await focus('C');
		await vi.advanceTimersByTimeAsync(300);

		expect(focusedCardStore.debouncedCard.value?.id).toBe('A');

		await vi.advanceTimersByTimeAsync(1000);

		expect(focusedCardStore.debouncedCard.value?.id).toBe('C');
	});

	it('never shows the skipped card B', async () => {
		const seen: Array<string | undefined> = [];

		await vi.advanceTimersByTimeAsync(1500);
		await focus('A');
		await vi.advanceTimersByTimeAsync(250);
		await focus('B');
		await vi.advanceTimersByTimeAsync(300);
		await focus('C');

		for (let i = 0; i < 30; i++) {
			await vi.advanceTimersByTimeAsync(100);
			seen.push(focusedCardStore.debouncedCard.value?.id);
		}

		expect(seen).not.toContain('B');
		expect(seen).toContain('C');
	});

	it('shows a lone change at once after a quiet pause (positive control)', async () => {
		await vi.advanceTimersByTimeAsync(1500);
		await focus('A');
		await vi.advanceTimersByTimeAsync(250);

		expect(focusedCardStore.debouncedCard.value?.id).toBe('A');
	});
});

// NMLolomo.kt:150-172: a music hero takes its cover palette, a video hero its poster palette.
describe('the theme color follows the hero card palette', () => {
	const color = (): string => document.documentElement.style.getPropertyValue('--color-primary');

	it('a music card sets the theme from its cover', () => {
		focusedCardStore.setThemeFollowsFocus(true);
		focusedCardStore.seed({ id: 'artist', color_palette: { cover: { dominant: '#3A5F7A' } } });

		expect(color()).toBe('#3A5F7A');
	});

	it('a video card sets the theme from its poster (positive control)', () => {
		focusedCardStore.seed({ id: 'movie', color_palette: { poster: { dominant: '#7A3A3A' } } });

		expect(color()).toBe('#7A3A3A');
	});
});
