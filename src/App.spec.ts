import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';

import App from './App.vue';
import { authStore } from '@/stores/authStore';

vi.mock('vue-router', () => ({
	useRouter: () => ({ currentRoute: { value: { path: '/music/now-playing' } }, back: vi.fn() }),
}));

vi.mock('@/players/music/MusicPlayer.vue', () => ({
	default: { name: 'MusicPlayer', template: '<div class="music-engine"><slot /></div>' },
}));

vi.mock('@/layout/ScreensaverOverlay.vue', () => ({
	default: { name: 'ScreensaverOverlay', template: '<div />' },
}));

const server = {
	serverId: 'made-up-server',
	serverUrl: 'https://example.test',
	defaultSubtitleLanguage: null,
	defaultAudioLanguage: null,
};

function token(exp: number): string {
	return `header.${btoa(JSON.stringify({ sub: 'made-up-user', exp }))}.signature`;
}

describe('the receiver asks for a new cast on every screen when the sign-in ends', () => {
	const requester = vi.fn();
	let wrapper: VueWrapper;

	/** A music cast on the now-playing screen whose token has 60 s left. */
	function castMusic(): void {
		authStore.setRenewalRequester(requester);
		authStore.consumeRealHandshake(token(Math.floor(Date.now() / 1000) + 60), server);
		wrapper = mount(App, {
			attachTo: document.body,
			global: { stubs: { RouterView: { template: '<div class="now-playing">made-up song</div>' } } },
		});
	}

	async function untilExpiry(): Promise<void> {
		vi.advanceTimersByTime(60_000);
		await nextTick();
		await nextTick();
	}

	beforeEach(() => {
		// jsdom has no layout, so it has no scrollIntoView.
		Element.prototype.scrollIntoView = vi.fn();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
		requester.mockClear();
	});

	afterEach(() => {
		wrapper.unmount();
		authStore.clear();
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('keeps the music screen until the token expires, then shows the cast-again screen', async () => {
		castMusic();

		vi.advanceTimersByTime(59_900);
		await nextTick();
		expect(wrapper.find('.now-playing').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('Cast again');

		await untilExpiry();
		expect(wrapper.find('.now-playing').exists()).toBe(false);
		expect(wrapper.text()).toContain('Your sign-in on this TV is ending. Cast again from your phone to keep watching.');
	});

	it('titles the screen as a request to cast again, not as an error', async () => {
		castMusic();
		await untilExpiry();

		expect(wrapper.find('h1').text()).toBe('Cast again to keep watching');
		expect(wrapper.text()).not.toContain('Something went wrong');
	});

	it('keeps the receiver logo and background while the cast-again screen shows', async () => {
		castMusic();
		await untilExpiry();

		expect(wrapper.find('img.brand[alt="NoMercy"]').exists()).toBe(true);
		expect(wrapper.find('img.bg').exists()).toBe(true);
	});

	it('focuses "Try again" and sends a new renewal request on Enter', async () => {
		castMusic();
		await untilExpiry();
		const button = wrapper.find('button');
		expect(button.text()).toBe('Try again');
		expect(document.activeElement).toBe(button.element);
		requester.mockClear();

		button.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		expect(requester).toHaveBeenCalledTimes(1);
	});

	it('returns to the screen it replaced when a fresh token arrives', async () => {
		castMusic();
		await untilExpiry();

		expect(authStore.acceptRenewedToken(token(Math.floor(Date.now() / 1000) + 600))).toBe(true);
		await nextTick();

		expect(wrapper.find('.now-playing').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('Cast again');
	});
});
