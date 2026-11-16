import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, KeepAlive, ref } from 'vue';
import EmptyState from '@/components/feedback/EmptyState.vue';
import { useDPad } from '@/composables/useDPad';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { focusStore } from '@/stores/focusStore';
import { decls } from '../cssDecl';

Element.prototype.scrollIntoView = vi.fn();

let wrapper: VueWrapper | undefined;

afterEach(() => {
	wrapper?.unmount();
	wrapper = undefined;
	document.body.innerHTML = '';
});

describe('small rows match the KMP TV app', () => {
	it('search.bar: 75 percent of the page width (SearchScreen.kt:114)', () => {
		expect(decls('views/search/SearchScreen.vue', '.query-bar').width).toBe('75%');
	});

	it('nm.NMEmptyState: 48 px icon above the message (NMEmptyState.kt:53-59)', () => {
		const icon = decls('components/feedback/EmptyState.vue', '.empty-icon');

		expect([icon.width, icon.height]).toEqual(['48px', '48px']);
		wrapper = mount(EmptyState, { props: { message: 'Nothing here' }, attachTo: document.body });
		expect(document.querySelector('.empty-state > .empty-icon')).not.toBeNull();
	});
});

function press(key: string): void {
	(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

const Rail = defineComponent({
	setup() {
		const first = ref<HTMLElement | null>(null);
		const second = ref<HTMLElement | null>(null);
		const group = useFocusGroup({ type: 'horizontal', restorationKey: 'test-rail' });

		useFocusEntry({
			key: 'a',
			group,
			order: 0,
			el: first,
		});

		useFocusEntry({
			key: 'b',
			group,
			order: 1,
			el: second,
		});

		return () => h('div', [
			h('button', {
				ref: first,
				'data-focusable': '',
				tabindex: 0,
				id: 'a',
			}),
			h('button', {
				ref: second,
				'data-focusable': '',
				tabindex: 0,
				id: 'b',
			}),
		]);
	},
});

describe('d-pad focus memory and back (TvCardViewHolder.kt:279-294,348-350)', () => {
	it('dpad.focus.memory: leaving a screen and coming back lands on the entry that held focus', async () => {
		const page = ref<'rail' | 'other'>('rail');
		const Host = defineComponent({
			setup: () => () => h(KeepAlive, null, [page.value === 'rail'
				? h(Rail)
				: h('div')]),
		});

		wrapper = mount(Host, { attachTo: document.body });
		await flushPromises();
		document.getElementById('b')!.focus();
		page.value = 'other';
		await flushPromises();
		expect(focusStore.consumeRestoration('test-rail')).toBe('b');
		page.value = 'rail';
		await flushPromises();
		expect(document.activeElement?.id).toBe('b');
	});

	it('dpad.back: Back goes to the previous route when no modal is open', async () => {
		const router = {
			back: vi.fn(),
			replace: vi.fn(),
			currentRoute: { value: { path: '/info/tv/1' } },
		};
		const Host = defineComponent({
			setup() {
				useDPad(router as never);

				return () => h(Rail);
			},
		});

		window.history.replaceState({ back: '/' }, '');
		wrapper = mount(Host, { attachTo: document.body });
		await flushPromises();
		document.getElementById('a')!.focus();
		press('Escape');
		expect(router.back).toHaveBeenCalledTimes(1);
	});
});
