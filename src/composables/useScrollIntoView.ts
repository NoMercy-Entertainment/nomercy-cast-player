import type { Ref } from 'vue';

/**
 * Scroll a focused element into view with TV-safe margin. Used by rails
 * and grids to center the active card. Browser handles scroll-margin-inline
 * via CSS (per tv-safe.css), this composable is the JS pathway when CSS
 * containment can't carry it.
 */
export function useScrollIntoView(
	containerEl: Ref<HTMLElement | null>,
) {
	function scrollTo(el: HTMLElement): void {
		const container = containerEl.value;

		if (!container) {
			el.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'center',
			});

			return;
		}

		const containerRect = container.getBoundingClientRect();
		const elRect = el.getBoundingClientRect();
		const offset = elRect.left - containerRect.left - (containerRect.width - elRect.width) / 2;

		container.scrollBy({ left: offset, behavior: 'smooth' });
	}

	return { scrollTo } as const satisfies { scrollTo: (el: HTMLElement) => void };
}
