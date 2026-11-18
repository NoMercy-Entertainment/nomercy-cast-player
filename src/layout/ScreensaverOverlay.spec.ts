import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import { playbackStore } from '@/stores/playbackStore';
import { screensaverStore } from '@/stores/screensaverStore';

const items = ref<unknown[]>([]);

vi.mock('@/queries/useScreensaverQuery', () => ({
	useScreensaverQuery: () => ({ data: items }),
}));

const { default: ScreensaverOverlay } = await import('./ScreensaverOverlay.vue');

function item(letter: string) {
	return {
		aspectRatio: 1.78,
		src: `/example-${letter}.jpg`,
		color_palette: {},
		meta: {
			title: `Example ${letter}`,
			logo: {
				aspectRatio: 2.5,
				src: `/logo-${letter}.png`,
			},
		},
	};
}

const Host = defineComponent({
	setup() {
		useDPad({
			back: vi.fn(),
			replace: vi.fn(),
			currentRoute: { value: { path: '/' } },
		} as never);

		return () => h(ScreensaverOverlay);
	},
});

let wrapper: VueWrapper | undefined;

function bg(): string | undefined {
	return wrapper?.find('[data-screensaver-bg]').attributes('src');
}

beforeEach(async () => {
	vi.useFakeTimers();
	items.value = [item('a'), item('b'), item('c')];
	screensaverStore.resetIndex();
	playbackStore.video.playing.value = false;
	// Let the store's play-state watcher settle before the screensaver is armed.
	await nextTick();
	screensaverStore.active.value = true;
});

afterEach(() => {
	wrapper?.unmount();
	wrapper = undefined;
	screensaverStore.deactivate();
	vi.useRealTimers();
});

// ImageModal.kt:246-247,266: art at 3840, logo at 500, the logo comes 4000 ms after the foreground.
describe('the screensaver draws the server art', () => {
	it('shows the art, then the foreground card, then the logo', async () => {
		wrapper = mount(Host);

		// ScreensaverStore.kt:240: the index advances before the first image, so the second item opens.
		expect(bg()).toBe('https://image.tmdb.org/t/p/original/example-b.jpg');
		expect(wrapper.find('[data-screensaver-art]').exists()).toBe(false);

		// ImageModal.kt:182,283: the foreground follows after 2400 ms.
		await vi.advanceTimersByTimeAsync(2_400);

		expect(wrapper.find('[data-screensaver-art]').attributes('src'))
			.toBe('https://image.tmdb.org/t/p/original/example-b.jpg');

		expect(wrapper.find('[data-screensaver-logo]').exists()).toBe(false);

		await vi.advanceTimersByTimeAsync(3_999);
		expect(wrapper.find('[data-screensaver-logo]').exists()).toBe(false);
		await vi.advanceTimersByTimeAsync(1);

		expect(wrapper.find('[data-screensaver-logo]').attributes('src'))
			.toBe('https://image.tmdb.org/t/p/w500/logo-b.png');
	});

	it('stays black until the foreground has loaded, then fades the veil out over 2500 ms', async () => {
		wrapper = mount(Host);
		await vi.advanceTimersByTimeAsync(2_400);

		const veil = (): string => wrapper!.find('[data-screensaver-veil]').attributes('style') ?? '';

		expect(veil()).toContain('opacity: 1');

		await wrapper.find('[data-screensaver-art]').trigger('load');
		expect(veil()).toContain('opacity: 0');
		expect(veil()).toContain('2500ms');
	});

	it('keeps the dim layer when the server sent no art', () => {
		items.value = [];
		wrapper = mount(Host);

		expect(wrapper.find('.dim').exists()).toBe(true);
		expect(wrapper.find('[data-screensaver-bg]').exists()).toBe(false);
	});
});

// ScreensaverStore.kt:184,261: sequential, wrapping, one image every 40 s; ImageModal.kt:253,188: 2500 ms fade to black first.
describe('the screensaver rotates', () => {
	it('moves to the next image after 40 s plus the 2500 ms fade', async () => {
		wrapper = mount(Host);
		expect(bg()).toContain('example-b.jpg');

		await vi.advanceTimersByTimeAsync(40_000 + 2_499);
		expect(bg()).toContain('example-b.jpg');
		await vi.advanceTimersByTimeAsync(1);
		expect(bg()).toContain('example-c.jpg');
		expect(wrapper.find('[data-screensaver-logo]').exists()).toBe(false);

		await vi.advanceTimersByTimeAsync(40_000);
		expect(bg()).toContain('example-a.jpg');
	});
});

// ScreensaverStore.kt:228,ImageModal.kt:210: no screensaver while the video plays.
describe('the screensaver never covers a video', () => {
	it('draws nothing while the video plays', async () => {
		wrapper = mount(Host);
		expect(wrapper.find('[data-screensaver-bg]').exists()).toBe(true);

		playbackStore.video.playing.value = true;
		await wrapper.vm.$nextTick();

		expect(wrapper.find('.screensaver').exists()).toBe(false);
	});
});

// useDPad.ts:58-67: the first key press wakes the receiver.
describe('a D-pad press wakes the receiver', () => {
	it('removes the screensaver on the first key', async () => {
		wrapper = mount(Host, { attachTo: document.body });
		expect(wrapper.find('[data-screensaver-bg]').exists()).toBe(true);

		document.body.dispatchEvent(new KeyboardEvent('keydown', {
			key: 'ArrowDown',
			bubbles: true,
			cancelable: true,
		}));

		await wrapper.vm.$nextTick();

		expect(wrapper.find('.screensaver').exists()).toBe(false);
	});
});
