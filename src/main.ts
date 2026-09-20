import { createApp } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import router from './router';
import { bootCastReceiver } from './cast/receiver';
import { defaultQueryClientOptions, setQueryClient, staleSweep } from './queries/client';
import { socketStore } from './stores/socketStore';
import { scheduleIdle } from './composables/useIdleCallback';
import { installCrashHandlers } from './lib/diagnostics/crashHandler';
import { installDiagnosticsConsoleTap } from './lib/diagnostics/consoleTap';
import { DiagnosticsCategory, DiagnosticsCode } from './lib/diagnostics/events';
import { recordDiagnostic } from './lib/diagnostics/sink';
import './styles/tailwind.css';

/**
 * Bootstrap order:
 *   1. Construct query client + register the singleton in queries/client.ts
 *      so non-component code (stores, message handlers) can invalidate it.
 *   2. Mount Vue app with router + query client.
 *   3. Boot cast receiver — wires custom namespaces, attaches launch
 *      listener, dispatches initial intent into router, kicks SignalR.
 *   4. Wire visibilitychange + stale-sweep timer per spec §6.4 + §6.5.
 *
 * The CAF SDK is loaded synchronously in index.html before main.ts runs,
 * so cast.framework is available by the time bootCastReceiver fires.
 */

installCrashHandlers();

// Every error and warning the receiver catches and swallows. One seam covers
// every `catch` block that logs instead of throwing.
installDiagnosticsConsoleTap();

const queryClient = new QueryClient(defaultQueryClientOptions);
setQueryClient(queryClient);

const app = createApp(App);
app.use(router);
app.use(VueQueryPlugin, { queryClient });

app.mount('#app');

bootCastReceiver(router);

// Foreground resume sweep — visibilitychange hidden→visible triggers
// invalidateAllLibrary so we catch missed RefreshLibrary events while
// cast_shell had us suspended.
document.addEventListener('visibilitychange', () => {
	// Which screen was on when the receiver went away is half the story of
	// every "it just stopped" report.
	const screen = String(router.currentRoute.value.name ?? router.currentRoute.value.path);
	recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.VisibilityChanged, 0, 0, 0, `${document.visibilityState} ${screen}`);

	if (document.visibilityState === 'visible') {
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.AppForegrounded, 0, 0, 0, screen);
		socketStore.onForegroundResume();
		return;
	}
	recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.AppBackgrounded, 0, 0, 0, screen);
});

// Stale sweep timer per spec §6.5. Every 30 minutes, idle-fenced, walk
// the cache and invalidate queries older than 3 hours.
const STALE_SWEEP_INTERVAL_MS = 30 * 60_000;
window.setInterval(() => {
	scheduleIdle(() => staleSweep(), { timeout: 5_000 });
}, STALE_SWEEP_INTERVAL_MS);

// Pre-warm common server-component renderers per spec §11.3. Idle-fenced
// so they don't fight the home query for first-paint bandwidth.
scheduleIdle(() => {
	void import('./server-components/NMCarousel.vue');
	void import('./server-components/NMGrid.vue');
	void import('./server-components/NMHomeCard.vue');
	void import('./server-components/NMHero.vue');
	void import('./server-components/NMCard.vue');
	void import('./server-components/NMMusicCard.vue');
	void import('./server-components/NMMusicHomeCard.vue');
	void import('./server-components/NMHeroCard.vue');
});
