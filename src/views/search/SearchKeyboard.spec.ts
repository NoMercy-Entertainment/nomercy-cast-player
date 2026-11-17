import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchKeyboard from './SearchKeyboard.vue';

describe('the search keyboard draws its utility keys with Moooom icons', () => {
	Element.prototype.scrollIntoView = vi.fn();

	const keyIcon = (focusKeyLabel: string) => {
		const wrapper = mount(SearchKeyboard, { props: { mode: 'video' } });
		const button = wrapper.get(`[aria-label="${focusKeyLabel}"]`);

		return { button, icon: button.find('svg.moooom-icon').attributes('data-icon') };
	};

	it.each([
		['Search videos', 'film'],
		['Search music', 'noteDouble'],
		['Space', 'keyboard'],
		['Backspace', 'eraser'],
	])('draws %s as the %s icon, without a text glyph', (label, name) => {
		const { button, icon } = keyIcon(label);

		expect(icon).toBe(name);
		expect(button.text()).toBe('');
	});
});
