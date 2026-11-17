import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import MusicListScreen from './MusicListScreen.vue';
import { socketStore } from '@/stores/socketStore';
import { focusStore } from '@/stores/focusStore';
import { playbackStore } from '@/stores/playbackStore';
import { musicSyncBridge } from '@/players/music/syncBridge';
import { useDPad } from '@/composables/useDPad';

const push = vi.fn();

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: { type: 'album', id: 'alb-1' } }),
	useRouter: () => ({ push }),
}));

// The server's shape: lists and tracks carry `name` (KMP MusicList.kt:12, PlaylistItem).
const listData = ref({
	id: 'alb-1',
	name: 'Test Album',
	tracks: [
		{
			id: 'trk-1',
			name: 'Track One',
			artist_track: [{ id: 'a1', name: 'Band' }],
		},
		{ id: 'trk-2', name: 'Track Two' },
	],
});

vi.mock('@/queries/useMusicListQuery', () => ({
	useMusicListQuery: () => ({
		data: listData,
		isLoading: ref(false),
		error: ref(null),
		refetch: vi.fn(),
	}),
}));

// jsdom has no layout, so it has no scrollIntoView; focusing a row calls it.
Element.prototype.scrollIntoView = vi.fn();

function screen(): ReturnType<typeof mount> {
	return mount(MusicListScreen);
}

describe('pressing Play announces the start to the server and stays on the list', () => {
	beforeEach(() => {
		push.mockClear();
	});

	afterEach(() => {
		socketStore.musicHub.value = null;
	});

	it('does not navigate to Now Playing when the music hub is down', async () => {
		socketStore.musicHub.value = null;

		const wrapper = screen();

		await wrapper.find('[aria-label="Play"]').trigger('click');
		await flushPromises();

		expect(push).not.toHaveBeenCalledWith('/now-playing');
	});

	it('stays on the list and shows an error when the server answers ok: false', async () => {
		const invoke = vi.fn(async () => ({
			ok: false,
			error_code: 'invalid_input',
			message: 'no',
		}));

		socketStore.musicHub.value = { invoke } as unknown as typeof socketStore.musicHub.value;

		const wrapper = screen();

		await wrapper.findAll('.track-row')[1]!.trigger('click');
		await flushPromises();

		expect(invoke).toHaveBeenCalledWith('StartPlaybackCommand', 'album', 'alb-1', 'trk-2');
		expect(push).not.toHaveBeenCalledWith('/now-playing');
		expect(wrapper.find('.start-error').exists()).toBe(true);
	});

	it('the Play button still starts track 1 when the server answers ok: true', async () => {
		const invoke = vi.fn(async () => ({ ok: true }));

		socketStore.musicHub.value = { invoke } as unknown as typeof socketStore.musicHub.value;

		const wrapper = screen();

		await wrapper.find('[aria-label="Play"]').trigger('click');
		await flushPromises();

		expect(invoke).toHaveBeenCalledWith('StartPlaybackCommand', 'album', 'alb-1', 'trk-1');
		expect(push).not.toHaveBeenCalled();
	});
});

describe('the D-pad reaches the track rows from the Play button', () => {
	let wrapper: ReturnType<typeof mount> | null = null;

	beforeEach(() => {
		push.mockClear();
	});

	afterEach(() => {
		wrapper?.unmount();
		wrapper = null;
		socketStore.musicHub.value = null;
		document.body.innerHTML = '';
	});

	it('pressing Down from Play focuses track 1, then track 2, and OK plays track 2', async () => {
		const invoke = vi.fn(async () => undefined);

		socketStore.musicHub.value = { invoke } as unknown as typeof socketStore.musicHub.value;

		wrapper = mount(MusicListScreen, { attachTo: document.body });
		await flushPromises();
		const rows = [...document.body.querySelectorAll<HTMLElement>('.track-row')];

		expect(rows).toHaveLength(2);
		document.body.querySelector<HTMLElement>('[aria-label="Play"]')!.focus();

		focusStore.activeGroup()?.handleKey('down');
		expect(document.activeElement, 'first Down reaches track 1').toBe(rows[0]);

		focusStore.activeGroup()?.handleKey('down');
		expect(document.activeElement, 'second Down reaches track 2').toBe(rows[1]);

		focusStore.dispatchAction();
		await flushPromises();

		expect(invoke).toHaveBeenCalledTimes(1);
		expect(invoke).toHaveBeenCalledWith('StartPlaybackCommand', 'album', 'alb-1', 'trk-2');
		expect(push).not.toHaveBeenCalled();
	});

	it('starts track 2 once when OK is pressed on its row', async () => {
		const invoke = vi.fn(async () => undefined);

		socketStore.musicHub.value = { invoke } as unknown as typeof socketStore.musicHub.value;
		const DPadHost = defineComponent({
			setup() {
				useDPad({ back: vi.fn(), currentRoute: { value: { path: '/music/album/alb-1' } } } as never);

				return () => h('div');
			},
		});
		const dpad = mount(DPadHost);

		wrapper = mount(MusicListScreen, { attachTo: document.body });
		await flushPromises();
		document.body.querySelector<HTMLElement>('[aria-label="Play"]')!.focus();
		pressKey('ArrowDown');
		pressKey('ArrowDown');
		expect(document.activeElement).toBe(document.body.querySelectorAll('.track-row')[1]);

		pressKey('Enter');
		await flushPromises();
		dpad.unmount();

		expect(invoke).toHaveBeenCalledTimes(1);
		expect(invoke).toHaveBeenCalledWith('StartPlaybackCommand', 'album', 'alb-1', 'trk-2');
	});

	it('focuses Play when the list arrives after the screen mounted', async () => {
		const loaded = listData.value;

		listData.value = null as unknown as typeof loaded;
		// A fresh visit: an earlier test left the row its user moved to.
		focusStore.saveRestoration('music-list-tracks', 'music-list-play');

		wrapper = mount(MusicListScreen, { attachTo: document.body });
		await flushPromises();
		expect(document.activeElement).toBe(document.body);

		listData.value = loaded;
		await flushPromises();

		expect(document.activeElement).toBe(document.body.querySelector('[aria-label="Play"]'));
	});
});

describe('the list page plays on this device like the KMP list screen', () => {
	const playTrack = vi.fn();
	const engine = {
		playTrack,
		play: vi.fn(),
		pause: vi.fn(),
	};
	const original = listData.value;

	beforeEach(() => {
		push.mockClear();
		playTrack.mockClear();
		vi.spyOn(musicSyncBridge, 'current').mockReturnValue(engine as never);
		playbackStore.music.applyTrack(null, []);
		playbackStore.music.applyList(null);
		playbackStore.music.applyPlayState(false);
		socketStore.musicHub.value = { invoke: vi.fn(async () => ({ ok: true })) } as never;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		listData.value = original;
		socketStore.musicHub.value = null;
	});

	it('music-01: a track click loads the clicked track and the whole list into the engine', async () => {
		const wrapper = screen();

		await wrapper.findAll('.track-row')[1]!.trigger('click');
		await flushPromises();

		expect(playTrack).toHaveBeenCalledTimes(1);
		expect(playTrack.mock.calls[0]![0]).toMatchObject({ id: 'trk-2' });
		expect((playTrack.mock.calls[0]![1] as Array<{ id: string }>).map((t) => t.id)).toEqual(['trk-1', 'trk-2']);
	});

	it('music-03: starting a track keeps the user on the list', async () => {
		const wrapper = screen();

		await wrapper.findAll('.track-row')[0]!.trigger('click');
		await wrapper.find('[aria-label="Play"]').trigger('click');
		await flushPromises();

		expect(push).not.toHaveBeenCalled();
	});

	it('music-04: a track playing from another list leaves Play as Play', () => {
		listData.value = { ...original, link: 'music/albums/alb-1' } as never;
		playbackStore.music.applyTrack({ id: 'trk-1', name: 'One' } as never, []);
		playbackStore.music.applyPlayState(true);
		playbackStore.music.applyList('music/playlists/other');

		const wrapper = screen();

		expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
		expect(wrapper.find('[aria-label="Pause"]').exists()).toBe(false);
	});

	it('music-04: the same list shows Pause while it plays and has no Resume label', () => {
		listData.value = { ...original, link: 'music/albums/alb-1' } as never;
		playbackStore.music.applyTrack({ id: 'trk-1', name: 'One' } as never, []);
		playbackStore.music.applyList('music/albums/alb-1');
		playbackStore.music.applyPlayState(true);

		const wrapper = screen();

		expect(wrapper.find('[aria-label="Pause"]').exists()).toBe(true);

		playbackStore.music.applyPlayState(false);

		return wrapper.vm.$nextTick().then(() => {
			expect(wrapper.find('[aria-label="Play"]').exists()).toBe(true);
			expect(wrapper.text()).not.toContain('Resume');
		});
	});

	it('music-04: Play is disabled when the list has no tracks', () => {
		listData.value = { ...original, tracks: [] } as never;

		const wrapper = screen();

		expect(wrapper.find('[aria-label="Play"]').attributes('disabled')).toBeDefined();
	});

	it('music-06: the header reads Type - year with no count, duration or column header', () => {
		listData.value = {
			...original,
			type: 'albums',
			year: 2020,
		} as never;

		const wrapper = screen();

		expect(wrapper.find('.kind').text()).toBe('Album');
		expect(wrapper.find('.year').text()).toBe('2020');
		expect(wrapper.find('.tracks-head').exists()).toBe(false);
		expect(wrapper.find('.track-row .duration').exists()).toBe(false);
	});

	it('music-06: a missing year falls back to the first track album year', () => {
		listData.value = {
			...original,
			type: 'album',
			tracks: [{
				id: 't',
				name: 'T',
				album_track: [{ year: 1999 }],
			}],
		} as never;

		const wrapper = screen();

		expect(wrapper.find('.year').text()).toBe('1999');
	});

	it('music-10: the header and every row show the server name, the artist under it', () => {
		listData.value = original as never;

		const wrapper = screen();

		expect(wrapper.find('h1.title').text()).toBe('Test Album');
		expect(wrapper.findAll('.track-title').map((row) => row.text())).toEqual(['Track One', 'Track Two']);
		expect(wrapper.find('.track-artist').text()).toBe('Band');
	});

	it('music-21: an overview without a description shows no About button', () => {
		listData.value = { ...original, overview: 'Only an overview' } as never;

		const wrapper = screen();

		expect(wrapper.find('[aria-label="About"]').exists()).toBe(false);
	});
});

/** A key press lands on the focused element and bubbles to the window, as on the TV. */
function pressKey(key: string): void {
	(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

function flushPromises(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
