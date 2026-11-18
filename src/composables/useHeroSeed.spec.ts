import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useHeroSeed } from '@/composables/useHeroSeed';
import { focusedCardStore } from '@/stores/focusedCardStore';
import { clearThemeColor } from '@/lib/theme';
import { pickPaletteColor } from '@/lib/images/urls';
import type { Component } from '@/server-components/types';

// AutoThemeColors.kt:16 / NMLolomo.kt:150-172: the pill follows the hero palette from the first frame.
// The home page is kept alive; a page that cleared the theme while it sat aside must not leave it purple.

const palette = { darkVibrant: '#2a6f4e', primary: '#2a6f4e', dominant: '#2a6f4e' };

const rows = [{
	id: 'home',
	component: 'NMLolomo',
	props: {
		id: 'home',
		items: [{
			id: 'row',
			component: 'NMCarousel',
			props: {
				id: 'row',
				items: [{
					id: 'card',
					component: 'NMCard',
					props: { data: { id: '00000000-0000-4000-8000-000000000001', title: 'A', backdrop: '/a.jpg', color_palette: { poster: palette } } },
				}],
			},
		}],
	},
}] as unknown as Component[];

afterEach(() => {
	clearThemeColor();
	focusedCardStore.seed(null);
});

describe('a kept-alive hero page re-applies the hero palette when it comes back', () => {
	it('sets --color-primary from the first card again after another page cleared it', async () => {
		const Home = defineComponent({
			name: 'Home',
			setup() {
				useHeroSeed(ref(rows));

				return () => h('div');
			},
		});
		const Info = defineComponent({
			name: 'Info',
			setup() {
				return () => h('div');
			},
		});
		const page = ref<'home' | 'info'>('home');
		const Shell = defineComponent({
			setup: () => () => h(KeepAlive, null, { default: () => h(page.value === 'home' ? Home : Info) }),
		});

		vi.useFakeTimers();
		mount(Shell);
		await nextTick();

		const wanted = pickPaletteColor(palette);

		expect(wanted).not.toBe('');
		expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(wanted);

		page.value = 'info';
		await nextTick();
		// InfoScreen.vue:62-64 on the way out.
		focusedCardStore.seed(null);
		clearThemeColor();

		page.value = 'home';
		await nextTick();

		expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(wanted);
		expect(focusedCardStore.debouncedCard.value?.title).toBe('A');
		vi.useRealTimers();
	});
});
