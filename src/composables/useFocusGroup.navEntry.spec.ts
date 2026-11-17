import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';

Element.prototype.scrollIntoView = () => {};

const Card = defineComponent({
	props: { id: { type: String, required: true } },
	setup(props) {
		const el = ref<HTMLElement | null>(null);

		useFocusEntry({ key: props.id, el });

		return () => h('button', {
			ref: el,
			id: props.id,
			'data-focusable': '',
			tabindex: 0,
		}, props.id);
	},
});

// A page opened from the nav bar: its cards arrive with the server data, after the press.
const Page = defineComponent({
	props: { loaded: { type: Boolean, required: true } },
	setup(props) {
		useFocusGroup({
			type: 'vertical',
			restorationKey: 'nav-entry-page',
			takeFocusFrom: '.topnav',
		});

		return () => h('main', props.loaded
			? ['a', 'b'].map((k) => h(Card, { id: `card-${k}` }))
			: []);
	},
});

const Host = defineComponent({
	props: { loaded: { type: Boolean, required: true } },
	setup(props) {
		const navItem = (): ReturnType<typeof h> => h('a', {
			id: 'nav-libraries',
			href: '/libraries',
			'data-focusable': '',
			tabindex: 0,
		}, 'Libraries');

		const nav = (): ReturnType<typeof h> => h('header', { class: 'topnav' }, [navItem()]);

		return () => h('div', [nav(), h(Page, { loaded: props.loaded })]);
	},
});

async function settle(): Promise<void> {
	await flushPromises();
	await nextTick();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

let wrapper: VueWrapper;

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
});

// TvHomeAdapter.kt:195,642-645: the first bind of row 0 focuses its first card, even with the nav bar focused.
describe('a page opened from the nav bar focuses its first card', () => {
	it('moves focus from the nav item to the first card once the rows arrive', async () => {
		wrapper = mount(Host, { attachTo: document.body, props: { loaded: false } });
		await settle();
		document.getElementById('nav-libraries')?.focus();
		await wrapper.setProps({ loaded: true });
		await settle();

		expect(document.activeElement?.id).toBe('card-a');
	});

	it('leaves the nav item focused after the first entry was placed', async () => {
		wrapper = mount(Host, { attachTo: document.body, props: { loaded: true } });
		await settle();
		expect(document.activeElement?.id).toBe('card-a');
		document.getElementById('nav-libraries')?.focus();
		await wrapper.setProps({ loaded: false });
		await settle();
		await wrapper.setProps({ loaded: true });
		await settle();

		expect(document.activeElement?.id).toBe('nav-libraries');
	});
});
