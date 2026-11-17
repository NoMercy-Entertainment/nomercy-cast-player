import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { useSearchQuery } from './useSearchQuery';

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock('@/lib/http/client', () => api);

// SearchScreen.kt:55-62 invalidates the search key on every new query or type.
describe('the search query asks the server every time the query or type changes', () => {
	beforeEach(() => {
		api.apiFetch.mockReset();
		api.apiFetch.mockResolvedValue([]);
	});

	const run = () => {
		const type = ref('all');
		const query = ref('matrix');
		const client = new QueryClient();
		const Host = defineComponent({
			setup() {
				useSearchQuery(type, query);

				return () => null;
			},
		});

		mount(Host, { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } });

		return { type, query };
	};

	it('refetches a query it answered a moment ago', async () => {
		const { type } = run();

		await flushPromises();
		type.value = 'music';
		await flushPromises();
		type.value = 'all';
		await flushPromises();

		expect(api.apiFetch).toHaveBeenCalledTimes(3);
	});

	it('searches three spaces, as the native length check does', async () => {
		const { query } = run();

		await flushPromises();
		api.apiFetch.mockClear();
		query.value = '   ';
		await flushPromises();

		expect(api.apiFetch).toHaveBeenCalledTimes(1);
	});
});
