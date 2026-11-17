import { describe, expect, it } from 'vitest';

const { default: router } = await import('@/router');

describe('tvNavHost.kt:138-155,228-237: the routes the TV app serves', () => {
	it('mediaRouteTypes.kt:11: /specials/:id is a detail page of type specials', () => {
		const route = router.resolve('/specials/12');

		expect(route.name).toBe('info-specials');
		expect(route.matched.length).toBeGreaterThan(0);
	});

	it('/favorites is its own screen, not the catch-all redirect', () => {
		const route = router.getRoutes().find((r) => r.name === 'favorites');

		expect(route?.redirect).toBeUndefined();
		expect(router.resolve('/favorites').name).toBe('favorites');
	});
});
