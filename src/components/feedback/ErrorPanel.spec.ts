import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

import ErrorPanel from './ErrorPanel.vue';

describe('the error panel action works with the D-pad wherever the panel is shown', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	it('focuses "Try again" and runs the retry on Enter with no focus group around it', async () => {
		// jsdom has no layout, so it has no scrollIntoView.
		Element.prototype.scrollIntoView = vi.fn();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const retry = vi.fn();

		const wrapper = mount(ErrorPanel, {
			props: { error: { message: 'made-up failure' }, retry },
			attachTo: document.body,
		});
		await nextTick();

		const button = wrapper.find('button').element;
		expect(warn.mock.calls.flat().join(' ')).not.toContain('used outside FocusGroup');
		expect(document.activeElement).toBe(button);

		button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(retry).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});
});
