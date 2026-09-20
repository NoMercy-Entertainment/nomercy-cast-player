import { createRouter, createWebHistory } from 'vue-router';
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router';
import { authStore } from '@/stores/authStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

/**
 * Two-tier routing per spec §10.6 (KeepAlive cache):
 *   - Splash routes (no shell) — render before auth lands
 *   - Shell routes — wrapped in AppShell with backdrop + topnav + KeepAlive
 *
 * Lazy chunks via dynamic import() — unused phases stay out of the initial
 * bundle. Phases 5-9 add concrete views inside AppShell's children.
 */

const routes: RouteRecordRaw[] = [
	{
		path: '/sender-required',
		name: 'sender-required',
		component: () => import('@/views/splash/SenderRequiredScreen.vue'),
	},
	{
		path: '/splash',
		name: 'splash',
		component: () => import('@/views/splash/ReadyToCastScreen.vue'),
	},
	// Watch is fullscreen — sits outside AppShell so the topnav and
	// backdrop don't paint behind the video. Path matches APK shape
	//   /{type}/{id}/watch
	{
		path: '/movie/:id/watch',
		name: 'watch-movie',
		component: () => import('@/views/watch/WatchScreen.vue'),
		props: route => ({ type: 'movie', id: route.params.id }),
	},
	{
		path: '/tv/:id/watch',
		name: 'watch-tv',
		component: () => import('@/views/watch/WatchScreen.vue'),
		props: route => ({ type: 'tv', id: route.params.id }),
	},
	{
		// Legacy /watch/:type/:id for sender-injected play_video intents
		// from navStore.dispatchInitialIntent (CastIntent.play_video).
		path: '/watch/:type/:id',
		name: 'watch-legacy',
		component: () => import('@/views/watch/WatchScreen.vue'),
	},
	{
		path: '/',
		component: () => import('@/layout/AppShell.vue'),
		children: [
			{
				path: '',
				name: 'home',
				component: () => import('@/views/home/HomeScreen.vue'),
			},
			{
				path: 'search',
				name: 'search',
				component: () => import('@/views/search/SearchScreen.vue'),
			},
			{
				path: 'libraries',
				name: 'libraries',
				component: () => import('@/views/libraries/LibrariesScreen.vue'),
			},
			// Library-style drilldowns. APK shape:
			//   /libraries/{id}
			//   /libraries/{id}/letter/{letter}
			//   /genres/{id}
			//   /specials, /genres, /collection (no id)
			{
				path: 'libraries/:id',
				name: 'library',
				component: () => import('@/views/library/LibraryScreen.vue'),
			},
			{
				path: 'libraries/:id/letter/:letter',
				name: 'library-letter',
				component: () => import('@/views/library/LibraryScreen.vue'),
			},
			{
				path: 'genres/:id',
				name: 'genre',
				component: () => import('@/views/library/LibraryScreen.vue'),
			},
			{
				path: 'specials',
				name: 'specials',
				component: () => import('@/views/library/LibraryScreen.vue'),
			},
			{
				path: 'genres',
				name: 'genres-index',
				component: () => import('@/views/library/LibraryScreen.vue'),
			},
			{
				path: 'collection',
				name: 'collection-index',
				component: () => import('@/views/library/LibraryScreen.vue'),
			},
			// Legacy /library/* fallback for anything that wasn't matched above.
			{
				path: 'library/:pathMatch(.*)*',
				name: 'library-legacy',
				component: () => import('@/views/library/LibraryScreen.vue'),
			},
			{
				// APK route shape — /movie/672, /tv/123 etc map to InfoScreen.
				// Each type registered as its own route so the matcher is happy.
				path: 'movie/:id',
				name: 'info-movie',
				component: () => import('@/views/info/InfoScreen.vue'),
				props: route => ({ type: 'movie', id: route.params.id }),
			},
			{
				path: 'tv/:id',
				name: 'info-tv',
				component: () => import('@/views/info/InfoScreen.vue'),
				props: route => ({ type: 'tv', id: route.params.id }),
			},
			{
				path: 'special/:id',
				name: 'info-special',
				component: () => import('@/views/info/InfoScreen.vue'),
				props: route => ({ type: 'special', id: route.params.id }),
			},
			{
				path: 'collection/:id',
				name: 'info-collection',
				component: () => import('@/views/info/InfoScreen.vue'),
				props: route => ({ type: 'collection', id: route.params.id }),
			},
			{
				path: 'person/:id',
				name: 'person',
				component: () => import('@/views/person/PersonScreen.vue'),
			},
			{
				path: 'music',
				name: 'music',
				component: () => import('@/views/music/MusicStartScreen.vue'),
			},
			{
				path: 'music/genres',
				name: 'music-genres',
				component: () => import('@/views/music/MusicGenresScreen.vue'),
			},
			{
				path: 'music/cards/:pathMatch(.*)*',
				name: 'music-cards',
				component: () => import('@/views/music/MusicCardsScreen.vue'),
			},
			{
				path: 'music/:type/:id',
				name: 'music-list',
				component: () => import('@/views/music/MusicListScreen.vue'),
			},
			{
				path: 'now-playing',
				name: 'now-playing',
				component: () => import('@/views/now-playing/NowPlayingScreen.vue'),
			},
			{
				path: 'profile',
				name: 'profile',
				component: () => import('@/views/profile/ProfileScreen.vue'),
			},
			{
				path: 'profile/settings',
				name: 'profile-settings',
				component: () => import('@/views/profile/AppSettingsScreen.vue'),
			},
			{
				path: 'profile/about',
				name: 'profile-about',
				component: () => import('@/views/profile/AboutScreen.vue'),
			},
			{
				path: 'profile/server-info',
				name: 'profile-server-info',
				component: () => import('@/views/profile/ServerInfoScreen.vue'),
			},
			// Phase 9 lands /watch.
		],
	},
];

if (import.meta.env.DEV) {
	routes.push({
		path: '/__focus',
		name: 'dev-focus-playground',
		component: () => import('@/views/__test__/FocusPlayground.vue'),
	});
}

routes.push({
	path: '/:pathMatch(.*)*',
	redirect: '/',
});

// "info-movie 672" reads as a place a viewer was; "info-movie" alone does not
// separate the title that stalled from the twenty that played.
function screenLabel(route: RouteLocationNormalized): string {
	const name = String(route.name ?? route.path);
	const id = route.params.id;
	if (typeof id === 'string' && id.length > 0)
		return `${name} ${id}`;

	return name;
}

export const router = createRouter({
	history: createWebHistory(),
	routes,
	scrollBehavior(_to, _from, savedPosition) {
		return savedPosition ?? { top: 0 };
	},
});

/**
 * Auth guard per spec §13 Phase 1 + Phase 4 — pre-auth, send to splash.
 * Receiver waits for LAUNCH customData before rendering protected routes.
 * Once customData is consumed, the navStore dispatches the initial intent
 * which routes to home/watch/now-playing as appropriate.
 */
router.beforeEach((to) => {
	if (to.name === 'sender-required' || to.name === 'splash')
		return true;
	if (import.meta.env.DEV && to.name === 'dev-focus-playground')
		return true;
	if (!authStore.ready.value) {
		return { name: 'splash', replace: true };
	}
	return true;
});

// The trail of screens is what turns a fault into a story — a report has to
// say where the viewer was, not only that something broke.
router.afterEach((to, from) => {
	if (from.name)
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenClosed, 0, 0, 0, screenLabel(from));

	recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, screenLabel(to));
});

export default router;
