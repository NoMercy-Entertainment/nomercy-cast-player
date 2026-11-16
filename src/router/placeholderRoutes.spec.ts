import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { router } from './index';
import { authStore } from '@/stores/authStore';

describe('unfinished routes', () => {
	// The redirect lands on '/'; its cold lazy import can pass the 5 s test
	// budget on a CI runner, so it loads once here with its own limit.
	beforeAll(async () => {
		for (const record of router.resolve('/').matched) {
			const load = record.components?.default;

			if (typeof load === 'function') {
				await (load as () => Promise<unknown>)();
			}
		}
	}, 30_000);

	afterEach(() => {
		authStore.clear();
	});

	it.each(['/person/placeholder-person', '/music/genres'])('redirects %s away from placeholder content', async (path) => {
		authStore.accessToken.value = 'placeholder-token';
		await router.push(path);
		expect(router.currentRoute.value.path).toBe('/');
	});
});
