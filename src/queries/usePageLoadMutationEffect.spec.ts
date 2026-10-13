import { QueryClient } from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setQueryClient } from './client';
import { usePageLoadMutationEffect } from './usePageLoadMutationEffect';
import type { Component } from '@/server-components/types';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: Record<string, unknown>) => apiFetch(options),
}));

function card(id: string, title?: string): Component {
	return { id, component: 'NMCarousel', props: { id, title, items: [] } };
}

describe('usePageLoadMutationEffect with a route param that changes under a reused component', () => {
	beforeEach(() => {
		apiFetch.mockReset();
	});

	it('writes the pageLoad refresh into the CURRENT route\'s cache key, not the key the component started with', async () => {
		const queryClient = new QueryClient();
		setQueryClient(queryClient);

		queryClient.setQueryData(['library', 'A'], [card('card1')]);
		queryClient.setQueryData(['library', 'B'], [card('card1')]);

		const keyRef = ref<readonly string[]>(['library', 'A']);
		const dataRef = ref<Component[] | undefined>(undefined);
		const isLoadingRef = ref(false);
		const isFetchingRef = ref(false);

		const Host = defineComponent({
			setup() {
				// AppShell reuses this component across library A/B routes (RouterView
				// + KeepAlive, no :key) — the hook must read the live route key, not a
				// value frozen at the first mount.
				usePageLoadMutationEffect(keyRef, dataRef, isLoadingRef, isFetchingRef);
				return () => h('div');
			},
		});
		mount(Host);

		let resolveFetch!: (value: unknown) => void;
		apiFetch.mockImplementation(() => new Promise((resolve) => {
			resolveFetch = resolve;
		}));

		dataRef.value = [
			{ ...card('card1'), update: { when: 'pageLoad', link: '/refresh', body: { replace_id: 'card1' } } },
		];
		await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());

		// User navigates from library A to library B while this card's
		// background refresh is still in flight — same component instance.
		keyRef.value = ['library', 'B'];

		resolveFetch(card('card1', 'Refreshed'));

		await vi.waitFor(() => {
			const b = queryClient.getQueryData(['library', 'B']) as Component[];
			expect((b[0].props as { title?: string }).title).toBe('Refreshed');
		});

		const a = queryClient.getQueryData(['library', 'A']) as Component[];
		expect((a[0].props as { title?: string }).title).toBeUndefined();
	});
});
