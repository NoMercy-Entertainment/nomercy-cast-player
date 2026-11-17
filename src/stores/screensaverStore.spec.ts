import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screensaverStore } from './screensaverStore';
import { settingsStore } from './settingsStore';

// SharedMainScreen.kt:168-171: the idle timeout is screensaverDelay minutes, default 5.
describe('the screensaver waits the account\'s delay', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		screensaverStore.deactivate();
		settingsStore.screensaverDelay.value = 5;
		vi.useRealTimers();
	});

	it('activates after one minute when the delay is one minute', () => {
		settingsStore.screensaverDelay.value = 1;
		screensaverStore.resetIdle();

		vi.advanceTimersByTime(59_000);
		expect(screensaverStore.active.value).toBe(false);
		vi.advanceTimersByTime(1_000);
		expect(screensaverStore.active.value).toBe(true);
	});

	it('waits five minutes by default', () => {
		screensaverStore.resetIdle();

		vi.advanceTimersByTime(299_000);
		expect(screensaverStore.active.value).toBe(false);
		vi.advanceTimersByTime(1_000);
		expect(screensaverStore.active.value).toBe(true);
	});
});
