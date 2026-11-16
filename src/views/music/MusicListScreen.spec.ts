import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';

import MusicListScreen from './MusicListScreen.vue';
import { socketStore } from '@/stores/socketStore';
import { focusStore } from '@/stores/focusStore';
import { useDPad } from '@/composables/useDPad';

const push = vi.fn();

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: { type: 'album', id: 'alb-1' } }),
	useRouter: () => ({ push }),
}));

const listData = ref({
	id: 'alb-1',
	title: 'Test Album',
	tracks: [
		{ id: 'trk-1', title: 'Track One' },
		{ id: 'trk-2', title: 'Track Two' },
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

describe('pressing Play only opens Now Playing once playback actually starts', () => {
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
		expect(push).toHaveBeenCalledWith('/now-playing');
	});

	it('navigates to Now Playing once the start command succeeds', async () => {
		socketStore.musicHub.value = {
			invoke: vi.fn(async () => undefined),
		} as unknown as typeof socketStore.musicHub.value;

		const wrapper = screen();

		await wrapper.find('[aria-label="Play"]').trigger('click');
		await flushPromises();

		expect(push).toHaveBeenCalledWith('/now-playing');
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
		expect(push).toHaveBeenCalledWith('/now-playing');
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

		wrapper = mount(MusicListScreen, { attachTo: document.body });
		await flushPromises();
		expect(document.activeElement).toBe(document.body);

		listData.value = loaded;
		await flushPromises();

		expect(document.activeElement).toBe(document.body.querySelector('[aria-label="Play"]'));
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
