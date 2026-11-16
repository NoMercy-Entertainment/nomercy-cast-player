import type { Router } from 'vue-router';

/**
 * Leave a page a cast opened. The splash has no navigation, so when the
 * page before this one is the splash (or there is none) go Home instead.
 */
export function leaveToPreviousOrHome(router: Router): void {
	const previous = (window.history.state as { back?: string | null } | null)?.back;

	if (!previous || previous === '/splash' || previous.startsWith('/splash?')) {
		void router.replace('/');
	} else {
		router.back();
	}
}
