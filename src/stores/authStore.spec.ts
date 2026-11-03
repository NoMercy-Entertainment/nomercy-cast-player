import { afterEach, describe, expect, it, vi } from 'vitest';
import { authStore } from './authStore';

function token(exp: number): string {
	return `header.${btoa(JSON.stringify({ sub: 'made-up-user', exp }))}.signature`;
}

describe('bare sender token renewal state', () => {
	afterEach(() => {
		authStore.clear();
		vi.useRealTimers();
	});
	it('requests renewal 30 seconds before expiry without degrading playback', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		const exp = Math.floor(Date.now() / 1000) + 60;
		expect(authStore.consumeRealHandshake(token(exp), {
			serverId: 'made-up-server',
			serverUrl: 'https://example.invalid',
			defaultSubtitleLanguage: null,
			defaultAudioLanguage: null,
		})).toBe(true);
		expect(authStore.renewalRequired.value).toBe(false);
		vi.advanceTimersByTime(30_000);
		expect(authStore.renewalRequired.value).toBe(true);
		expect(authStore.receiverState.value).not.toBe('DEGRADED');
	});
});
