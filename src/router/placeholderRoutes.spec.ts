import { afterEach, describe, expect, it } from 'vitest';
import { router } from './index';
import { authStore } from '@/stores/authStore';

describe('unfinished routes', () => {
	afterEach(() => {
		authStore.clear();
	});

	it.each(['/person/placeholder-person', '/music/genres'])('redirects %s away from placeholder content', async (path) => {
		authStore.accessToken.value = 'placeholder-token';
		await router.push(path);
		expect(router.currentRoute.value.path).toBe('/');
	});
});
