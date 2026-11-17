import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decls } from '../test/cssDecl';
import AppLogoSquare from './AppLogoSquare.vue';

// IcAppLogoSquare.kt:34-54,312: the back layer is the accent fading from alpha 1 to 0.8, the front layer is #F5F2FF.
describe('the nav app logo wears the native colors', () => {
	it('draws the front layer in #F5F2FF', () => {
		expect(decls('layout/AppLogoSquare.vue', 'svg')['--color-logo-front']).toBe('#f5f2ff');
	});

	it('draws the back layer with the accent gradient', () => {
		const wrapper = mount(AppLogoSquare);
		const back = wrapper.findAll('path').find((p) => p.attributes('fill-rule') === 'evenodd');

		expect(back?.attributes('fill')).toBe('url(#logo-back)');

		const stops = wrapper.findAll('#logo-back stop').map((s) => s.attributes('stop-opacity') ?? '1');

		expect(stops).toEqual(['1', '0.8']);
		expect(readFileSync(fileURLToPath(new URL('./AppLogoSquare.vue', import.meta.url)), 'utf8')).toContain('stop-color="var(--color-primary)"');
	});
});
