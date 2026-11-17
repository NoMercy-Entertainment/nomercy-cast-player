import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';

vi.mock('@/stores/authStore', async () => {
	const { ref: makeRef } = await import('vue');

	return { authStore: { ready: makeRef(true) } };
});

vi.mock('@/views/watch/WatchScreen.vue', () => ({
	default: defineComponent({ name: 'WatchStub', setup: () => () => h('div', { class: 'watch-stub' }) }),
}));

// A Continue watching card as the server sends it (HomeService.BuildContinueWatchingCards, CardData.cs:119-219).
function continueRow(link: string) {
	return {
		id: 'continue',
		component: 'NMCarousel',
		props: {
			id: 'continue',
			title: 'Continue watching',
			items: [{
				id: '00000000-0000-4000-8000-0000000000c1',
				component: 'NMCard',
				props: {
					id: '00000000-0000-4000-8000-0000000000c1',
					watch: true,
					data: {
						id: '1',
						title: 'Placeholder',
						link,
						progress: { time: 600, total: 1400 },
					},
				},
			}],
		},
	} as const;
}

// KMP Route.kt:90 opens any /{type}/{id}/watch link in the player (TvCardViewHolder.kt:294 navigates data.link).
describe('a continue watching card opens the player like the KMP TV card', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it.each([
		'/tv/60808/watch',
		'/movie/1204680/watch',
		'/collection/1776481/watch',
		'/specials/01JZ0000000000000000000000/watch',
	])('a card linking %s opens that watch route on OK', async (link) => {
		const { router } = await import('@/router');
		const { useDPad } = await import('@/composables/useDPad');
		const { useFocusGroup } = await import('@/composables/useFocusGroup');
		const Resolver = (await import('./Resolver.vue')).default;

		await router.push('/');
		await router.isReady();

		const Host = defineComponent({
			setup() {
				useDPad(router);
				useFocusGroup({ type: 'vertical', autoFocus: false });

				return () => h('div', [h(Resolver, { component: continueRow(link) as never })]);
			},
		});

		const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [router] } });

		await vi.waitFor(() => expect(wrapper.find('article.card').exists()).toBe(true));
		(wrapper.get('article.card').element as HTMLElement).focus();
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe(link));
		expect(router.currentRoute.value.matched[0]?.path).toContain('/watch');
		wrapper.unmount();
	});
});
