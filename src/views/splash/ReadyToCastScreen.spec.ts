import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ReadyToCastScreen from './ReadyToCastScreen.vue';
import { connectedSenders } from '@/cast/receiver';
import { authStore } from '@/stores/authStore';

const { closeCastSession } = vi.hoisted(() => ({ closeCastSession: vi.fn() }));
vi.mock('@/cast/receiver', async () => {
	const { ref } = await import('vue');
	return { closeCastSession, connectedSenders: ref(0) };
});

describe('the title tells the truth about the sender', () => {
	Element.prototype.scrollIntoView = vi.fn();

	afterEach(() => {
		document.body.innerHTML = '';
		connectedSenders.value = 0;
		authStore.receiverState.value = 'LOADING';
	});

	it('says Ready to cast, without the pulse, while no sender is attached', async () => {
		authStore.receiverState.value = 'LOADING';
		connectedSenders.value = 0;
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });
		await nextTick();

		const title = wrapper.get('h1');
		expect(title.text()).toBe('Ready to cast');
		expect(title.classes()).not.toContain('pulse');
	});

	it('says Connecting and pulses once a sender is attached', async () => {
		authStore.receiverState.value = 'LOADING';
		connectedSenders.value = 1;
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });
		await nextTick();

		const title = wrapper.get('h1');
		expect(title.text()).toBe('Connecting…');
		expect(title.classes()).toContain('pulse');
	});
});

describe('the Close button is only for a TV with no sender', () => {
	Element.prototype.scrollIntoView = vi.fn();

	afterEach(() => {
		document.body.innerHTML = '';
		connectedSenders.value = 0;
	});

	it('shows no Close while a sender is attached', async () => {
		connectedSenders.value = 1;
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });
		await nextTick();

		expect(wrapper.text()).not.toContain('Close');
		expect(wrapper.find('[data-focusable]').exists()).toBe(false);
	});

	it('shows Close, focused, when no sender is attached', async () => {
		connectedSenders.value = 0;
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });
		await nextTick();

		const close = wrapper.get('[data-focusable]');
		expect(close.text()).toBe('Close');
		expect(document.activeElement).toBe(close.element);
	});

	it('hides Close when a sender connects after the screen opened', async () => {
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });
		await nextTick();
		connectedSenders.value = 1;
		await nextTick();

		expect(wrapper.text()).not.toContain('Close');
	});
});

describe('the fallback splash screen is usable when no sender has shown up', () => {
	// jsdom has no layout, so it has no scrollIntoView.
	Element.prototype.scrollIntoView = vi.fn();

	afterEach(() => {
		document.body.innerHTML = '';
		closeCastSession.mockClear();
	});

	it('puts D-pad focus on a visible control so the remote does something', async () => {
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });
		await nextTick();

		const focused = document.activeElement;
		expect(focused).not.toBe(document.body);
		expect(wrapper.element.contains(focused)).toBe(true);
	});

	it('ends the cast session when the focused control is activated', async () => {
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });
		await nextTick();

		await wrapper.get('[data-focusable]').trigger('keydown', { key: 'Enter' });

		expect(closeCastSession).toHaveBeenCalled();
	});
});
