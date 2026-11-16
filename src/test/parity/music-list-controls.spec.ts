import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { useDPad } from '@/composables/useDPad';
import { decls } from '../cssDecl';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

Element.prototype.scrollIntoView = vi.fn();

const { default: MusicListScreen } = await import('@/views/music/MusicListScreen.vue');

const L = 'views/music/MusicListScreen.vue';
const LIST = {
	data: {
		id: '00000000-0000-4000-8000-000000000001',
		type: 'album',
		title: 'Example Album',
		description: 'About this example album.',
		link: '/music/albums/00000000-0000-4000-8000-000000000001',
		favorite: false,
		tracks: [{
			id: 't1',
			title: 'First',
			duration: 100,
		}],
	},
};

let wrapper: VueWrapper;

async function boot(): Promise<ReturnType<typeof createRouter>> {
	apiFetch.mockResolvedValue(LIST);
	const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { render: () => null } }] });

	await router.push('/music/album/1');
	await router.isReady();
	const Host = defineComponent({
		setup() {
			useDPad(router);

			return () => h(MusicListScreen);
		},
	});

	wrapper = mount(Host, { attachTo: document.body, global: { plugins: [VueQueryPlugin, router] } });
	await vi.waitFor(() => expect(document.querySelector('.music-list-controls')).not.toBeNull());
	await flushPromises();

	return router;
}

function press(key: string): void {
	(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

const icons = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.music-list-controls .icon-btn'));

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
	apiFetch.mockReset();
	vi.restoreAllMocks();
});

describe('music list controls match ListScreen.kt ControlHeader', () => {
	it('music.list.controls: row is space-between with end pad 52 (ListScreen.kt:348-358)', () => {
		const c = decls(L, '.music-list-controls');

		expect(c['justify-content']).toBe('space-between');
		expect(c['padding-right']).toBe('52px');
		expect(c['align-items']).toBe('center');
	});

	it('music.list.controls: icon buttons are 48 circles (MediaAboutButton.kt:56-60)', () => {
		const b = decls(L, '.icon-btn');

		expect([b.width, b.height, b['border-radius']]).toEqual(['48px', '48px', '50%']);
	});

	it('music.list.controls: back, like, about come before the play button (ListScreen.kt:360-381)', async () => {
		await boot();
		expect(icons().map((b) => b.getAttribute('aria-label'))).toEqual(['Back', 'Like', 'About']);
		const row = document.querySelector('.music-list-controls')!;

		expect(row.lastElementChild?.classList.contains('nm-pill')).toBe(true);
	});

	it('music.list.controls: back pops the route stack (ListScreen.kt:361)', async () => {
		const router = await boot();
		const back = vi.spyOn(router, 'back');

		icons()[0].click();
		expect(back).toHaveBeenCalledTimes(1);
	});

	it('music.list.controls: like posts the toggled value to the list link (MediaLikeButton.kt:41,86-92)', async () => {
		await boot();
		apiFetch.mockClear();
		apiFetch.mockResolvedValue({});
		icons()[1].click();
		await flushPromises();

		expect(apiFetch).toHaveBeenCalledWith(expect.objectContaining({
			path: '/api/v1/music/albums/00000000-0000-4000-8000-000000000001/like',
			method: 'POST',
			body: JSON.stringify({ value: true }),
		}));

		expect(icons()[1].getAttribute('aria-pressed')).toBe('true');
	});

	it('music.list.controls: about opens the description and Back closes it (MediaAboutButton.kt:80-111)', async () => {
		await boot();
		icons()[2].click();
		await flushPromises();
		expect(document.querySelector('.about-dialog')?.textContent).toContain('About this example album.');
		press('Escape');
		await flushPromises();
		expect(document.querySelector('.about-dialog')).toBeNull();
	});

	it('music.list.controls: D-pad moves back, like, about, play with UP and DOWN', async () => {
		await boot();
		icons()[0].focus();
		press('ArrowDown');
		expect(document.activeElement).toBe(icons()[1]);
		press('ArrowDown');
		expect(document.activeElement).toBe(icons()[2]);
		press('ArrowDown');
		expect(document.activeElement?.classList.contains('nm-pill')).toBe(true);
		press('ArrowUp');
		expect(document.activeElement).toBe(icons()[2]);
	});
});
