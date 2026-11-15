import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { ref } from 'vue';

import AppSettingsScreen from '@/views/profile/AppSettingsScreen.vue';
import ProfileScreen from '@/views/profile/ProfileScreen.vue';
import InfoScreen from '@/views/info/InfoScreen.vue';
import NowPlayingScreen from '@/views/now-playing/NowPlayingScreen.vue';
import MusicListScreen from '@/views/music/MusicListScreen.vue';
import ProgressControls from '@/players/music/ProgressControls.vue';
import NMHomeCard from '@/server-components/NMHomeCard.vue';
import { focusStore } from '@/stores/focusStore';
import type { Direction } from '@/stores/focusStore';

const { state, pending } = await vi.hoisted(async () => {
	const { ref: makeRef } = await import('vue');
	return {
		state: makeRef('idle'),
		pending: makeRef({ body: 'app 1.0' } as { body: string } | null),
	};
});

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
	useRoute: () => ({ params: { type: 'album', id: 'alb-1' } }),
}));

vi.mock('@/lib/diagnostics/sender', () => ({
	diagnosticsSender: {
		state,
		pending,
		previewText: ref(''),
		hasPending: ref(true),
		lastError: ref(null),
		lastReportId: ref('01a0bc49'),
		prepare: vi.fn(),
		discard: vi.fn(),
		confirmSend: vi.fn(),
	},
}));

vi.mock('@/queries/useMeQuery', () => ({
	useMeQuery: () => ({ data: ref({ name: 'Jordan', email: 'jordan@example.com' }) }),
}));

vi.mock('@/queries/useInfoQuery', () => ({
	useInfoQuery: () => ({
		data: ref({ id: 'title-1', title: 'Example Title', link: '/movies/title-1', watchlist: false }),
		isLoading: ref(false),
		error: ref(null),
		refetch: vi.fn(),
	}),
}));

vi.mock('@/queries/useTrailerQuery', () => ({
	useTrailerQuery: () => ({ data: ref(null) }),
}));

vi.mock('@/queries/useMusicListQuery', () => ({
	useMusicListQuery: () => ({
		data: ref({ id: 'alb-1', title: 'Test Album', tracks: [{ id: 'trk-1', title: 'Track One' }] }),
		isLoading: ref(false),
		error: ref(null),
		refetch: vi.fn(),
	}),
}));

let wrapper: VueWrapper | null = null;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	// jsdom has no scrollIntoView; every focus() call makes one.
	Element.prototype.scrollIntoView = vi.fn();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
	warn.mockRestore();
	document.body.innerHTML = '';
});

function outsideWarnings(): unknown[][] {
	return (warn.mock.calls as unknown[][]).filter(c => String(c[0]).includes('used outside FocusGroup'));
}

/** Presses a D-pad direction through the store, as the global key handler does. */
function press(dir: Direction): void {
	focusStore.activeGroup()?.handleKey(dir);
}

async function walk(
	component: unknown,
	dir: Direction,
	minRows: number,
	props: Record<string, unknown> = {},
	selector = '[data-focusable]',
): Promise<void> {
	wrapper = mount(component as never, {
		props: props as never,
		attachTo: document.body,
		global: { plugins: [VueQueryPlugin], stubs: { RouterLink: true, teleport: true, SetupBackdrop: true } },
	});
	await flushPromises();

	const rows = [...document.body.querySelectorAll<HTMLElement>(selector)];
	expect(rows.length).toBeGreaterThanOrEqual(minRows);
	rows[0].focus();

	for (let i = 1; i < rows.length; i++) {
		press(dir);
		expect(document.activeElement, `${dir} number ${i} reaches row ${i}`).toBe(rows[i]);
	}
	expect(outsideWarnings()).toEqual([]);
}

describe('the D-pad moves focus row to row on screens that own their focus group', () => {
	it('settings: Down walks every row', async () => {
		await walk(AppSettingsScreen, 'down', 8);
	});

	it('profile: Down walks every row', async () => {
		await walk(ProfileScreen, 'down', 4);
	});

	it('info: Down walks the buttons that are on screen', async () => {
		await walk(InfoScreen, 'down', 2, { type: 'movies', id: 'title-1' });
	});

	it('now playing: Right walks the utility row', async () => {
		await walk(NowPlayingScreen, 'right', 3, {}, '.utility-row [data-focusable]');
	});

	it('music list: the play button registers in the list group', async () => {
		wrapper = mount(MusicListScreen, { attachTo: document.body, global: { plugins: [VueQueryPlugin] } });
		await flushPromises();
		document.body.querySelector<HTMLElement>('button[data-focusable]')!.focus();

		expect(focusStore.activeGroup()?.hasEntry('music-list-play')).toBe(true);
		expect(outsideWarnings()).toEqual([]);
	});

	it('music controls: Right walks the five transport buttons', async () => {
		await walk(ProgressControls, 'right', 5);
	});

	it('home card: Right moves from Watch to Details', async () => {
		await walk(NMHomeCard, 'right', 2, { id: 'home-1', data: { link: '/movies/title-1', title: 'Example' } });
	});
});
