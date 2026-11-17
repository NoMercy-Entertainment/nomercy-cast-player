import { onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';

// HeroSelectionTiming.kt:33: a hero change holds this long before the next one may replace it.
export const HERO_CHANGE_MS = 1400;

// HeroSelectionTiming.kt:40-43 pacedHero: a change shows at once, then holds; the newest value wins after.
export function usePacedValue<T>(source: Ref<T>, holdMs = HERO_CHANGE_MS): Ref<T> {
	const shown = ref(source.value) as Ref<T>;
	let timer: number | null = null;
	let pending: { value: T } | null = null;

	function startHold(): void {
		timer = window.setTimeout(() => {
			timer = null;

			if (pending) {
				const { value } = pending;

				pending = null;
				show(value);
			}
		}, holdMs);
	}

	function show(value: T): void {
		if (value === shown.value)
			return;

		shown.value = value;
		startHold();
	}

	watch(source, (next) => {
		if (timer === null)
			show(next);
		else
			pending = { value: next };
	});

	onBeforeUnmount(() => {
		if (timer !== null)
			window.clearTimeout(timer);
	});

	return shown;
}
