import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ReadyToCastScreen from './ReadyToCastScreen.vue';
import { connectedSenders } from '@/cast/receiver';
import { authStore } from '@/stores/authStore';
import { focusStore } from '@/stores/focusStore';

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

describe('the instructions keep a space after Chromecast', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders a word break between Chromecast and the rest of the line', async () => {
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });

		await nextTick();

		const text = wrapper.get('.instructions').element.textContent ?? '';

		expect(text).toMatch(/Chromecast\s+\S/);
	});
});

describe('the splash has no Close button and Back closes the session', () => {
	Element.prototype.scrollIntoView = vi.fn();

	afterEach(() => {
		document.body.innerHTML = '';
		connectedSenders.value = 0;
		closeCastSession.mockClear();
	});

	it.each([0, 1])('draws no control with %i senders attached', async (senders) => {
		connectedSenders.value = senders;
		const wrapper = mount(ReadyToCastScreen, { attachTo: document.body });

		await nextTick();

		expect(wrapper.text()).not.toContain('Close');
		expect(wrapper.find('[data-focusable]').exists()).toBe(false);
	});

	it('ends the cast session on Back', async () => {
		mount(ReadyToCastScreen, { attachTo: document.body });

		await nextTick();

		expect(focusStore.dispatchEscape()).toBe(true);
		expect(closeCastSession).toHaveBeenCalled();
	});
});
