import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import { usePacedValue } from './usePacedValue';

function host() {
	const source = ref('first');
	let shown!: { value: string };

	mount(defineComponent({
		setup() {
			shown = usePacedValue(source);

			return () => null;
		},
	}));

	return { source, shown: () => shown.value };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('HeroSelectionTiming.kt:33-44: a hero change holds 1400 ms', () => {
	it('shows A at once and holds it until 1400 ms before B replaces it', async () => {
		const { source, shown } = host();

		source.value = 'A';
		await nextTick();
		expect(shown()).toBe('A');

		vi.advanceTimersByTime(300);
		source.value = 'B';
		await nextTick();
		vi.advanceTimersByTime(1000);
		expect(shown()).toBe('A');

		vi.advanceTimersByTime(100);
		expect(shown()).toBe('B');
	});

	it('only the newest value shows after the hold', async () => {
		const { source, shown } = host();

		source.value = 'A';
		await nextTick();
		source.value = 'B';
		await nextTick();
		source.value = 'C';
		await nextTick();
		vi.advanceTimersByTime(1400);
		expect(shown()).toBe('C');
	});
});
