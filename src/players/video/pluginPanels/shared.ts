/**
 * Helpers shared between pluginPanels. Lives outside Vue land — the
 * panels mount raw DOM into the video player's overlay container, so we
 * implement focus traversal manually rather than going through the Vue
 * focusStore composables.
 */

export function dispatchOptionAction(
	root: HTMLElement,
	group: HTMLElement,
	axis: 'horizontal' | 'vertical',
): void {
	root.addEventListener('keydown', (e: KeyboardEvent) => {
		const focusable = Array.from(
			group.querySelectorAll<HTMLElement>('[data-focusable]'),
		).filter((el) => !el.hasAttribute('disabled'));
		const current = document.activeElement as HTMLElement | null;
		const idx = current
			? focusable.indexOf(current)
			: -1;

		let next = -1;

		if (axis === 'horizontal') {
			if (e.key === 'ArrowLeft') {
				next = idx - 1;
			} else if (e.key === 'ArrowRight') {
				next = idx + 1;
			}
		} else if (axis === 'vertical') {
			if (e.key === 'ArrowUp') {
				next = idx - 1;
			} else if (e.key === 'ArrowDown') {
				next = idx + 1;
			}
		}

		if (next >= 0 && next < focusable.length) {
			e.preventDefault();
			focusable[next].focus({ preventScroll: false });
			focusable[next].scrollIntoView({ block: 'nearest', inline: 'center' });
		}
	});
}
