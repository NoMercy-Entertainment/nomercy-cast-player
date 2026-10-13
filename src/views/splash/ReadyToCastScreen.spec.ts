import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ReadyToCastScreen from './ReadyToCastScreen.vue';

const { closeCastSession } = vi.hoisted(() => ({ closeCastSession: vi.fn() }));
vi.mock('@/cast/receiver', () => ({ closeCastSession }));

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
