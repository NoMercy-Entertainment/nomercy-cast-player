import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useNavFocusBridge } from '@/composables/useNavFocusBridge';

const scrollIntoView = vi.fn();
const focused = vi.fn<(id: string) => void>();

Element.prototype.scrollIntoView = scrollIntoView;

const Card = defineComponent({
	props: { id: { type: String, required: true } },
	setup(props) {
		const el = ref<HTMLElement | null>(null);

		useFocusEntry({
			key: props.id,
			el,
			onFocus: () => focused(props.id),
		});

		return () => h('button', {
			ref: el,
			id: props.id,
			'data-focusable': '',
			tabindex: 0,
		}, props.id);
	},
});

const Page = defineComponent({
	props: { name: { type: String, required: true } },
	setup(props) {
		const group = useFocusGroup({ type: 'horizontal', restorationKey: props.name });

		useNavFocusBridge(group);

		return () => h('div', ['a', 'b', 'c'].map((k) =>
			h(Card, { id: `${props.name}-${k}` })));
	},
});

const Host = defineComponent({
	props: {
		page: { type: String, default: 'p' },
		show: { type: Boolean, default: true },
	},
	setup(props) {
		useDPad({
			back: vi.fn(),
			replace: vi.fn(),
			currentRoute: { value: { path: '/' } },
		} as never);

		return () => h(KeepAlive, null, props.show
			? [h(Page, { key: props.page, name: props.page })]
			: []);
	},
});

function press(key: string): void {
	(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

let wrapper: VueWrapper;

async function settle(): Promise<void> {
	await flushPromises();
	await nextTick();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	scrollIntoView.mockClear();
	focused.mockClear();
});

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
});

describe('a page that comes back places its saved card instantly (VideoContentList.kt:231-257)', () => {
	it('restores without a smooth scroll, while a key press still scrolls smoothly', async () => {
		wrapper = mount(Host, { attachTo: document.body });
		await settle();
		press('ArrowRight');
		expect(document.activeElement?.id).toBe('p-b');
		expect(scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'smooth' }));

		await wrapper.setProps({ show: false });
		await settle();
		scrollIntoView.mockClear();
		await wrapper.setProps({ show: true });
		await settle();

		expect(document.activeElement?.id).toBe('p-b');
		expect(scrollIntoView).toHaveBeenCalled();
		expect(scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }));
	});
});

describe('only a user focus writes the saved position (TvUserFocusIntent.kt:28-44)', () => {
	it('a stray programmatic focus does not replace the card the user left on', async () => {
		wrapper = mount(Host, { props: { page: 'q' }, attachTo: document.body });
		await settle();
		press('ArrowRight');
		expect(document.activeElement?.id).toBe('q-b');

		document.getElementById('q-c')!.focus();
		await wrapper.setProps({ show: false });
		await settle();
		// A browser drops focus from a page it hides; jsdom does not.
		(document.activeElement as HTMLElement).blur();
		await wrapper.setProps({ show: true });
		await settle();

		expect(document.activeElement?.id).toBe('q-b');
	});
});

describe('the nav-down bridge answers on the live page only (TvNavigationBar.kt:125-130)', () => {
	it('a cached page does not take focus when the nav presses down', async () => {
		wrapper = mount(Host, { props: { page: 'one' }, attachTo: document.body });
		await settle();
		await wrapper.setProps({ page: 'two' });
		await settle();
		focused.mockClear();

		window.dispatchEvent(new CustomEvent('cast-receiver:nav-down'));

		expect(focused.mock.calls.filter(([id]) => id.startsWith('one-'))).toEqual([]);
		expect(document.activeElement?.id.startsWith('two-')).toBe(true);
	});
});
