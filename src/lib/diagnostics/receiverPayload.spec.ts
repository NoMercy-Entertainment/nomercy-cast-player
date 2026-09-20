// The receiver cannot be driven in a desktop browser: it talks to the Cast IPC
// socket on localhost:8008, which only exists on a real Chromecast. This is the
// substitute — the real components, the real composables and the real recorders
// mounted in the test environment, producing the same payload a device would.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import { videoSyncBridge } from '@/players/video/syncBridge';
import { musicSyncBridge } from '@/players/music/syncBridge';
import { apiFetch } from '@/lib/http/client';
import { authStore } from '@/stores/authStore';
import { ALL_PLAYER_EVENTS } from './playerEvents';
import { collectDeviceFacts } from './deviceFacts';
import { installDiagnosticsConsoleTap } from './consoleTap';
import { renderDiagnosticsReport } from './report';
import { diagnosticsRing, recordDiagnostic } from './sink';
import { DiagnosticsCategory, DiagnosticsCode } from './events';

interface FakeEngine {
	on: (event: string, handler: (...args: unknown[]) => void) => void;
	off: (event: string, handler?: (...args: unknown[]) => void) => void;
	emit: (event: string, payload?: unknown) => void;
	play: () => void;
	pause: () => void;
	seek: (seconds: number) => void;
	playlistItem: () => { id: number; type: string; tmdbId: number };
	currentTrack: () => { id: number };
}

function fakeEngine(): FakeEngine {
	const handlers = new Map<string, Array<(...args: unknown[]) => void>>();

	return {
		on(event, handler) {
			const list = handlers.get(event) ?? [];
			list.push(handler);
			handlers.set(event, list);
		},
		off(event, handler) {
			if (!handler) {
				handlers.delete(event);
				return;
			}
			handlers.set(event, (handlers.get(event) ?? []).filter(entry => entry !== handler));
		},
		emit(event, payload) {
			for (const handler of [...(handlers.get(event) ?? [])])
				handler(payload);
		},
		play: () => {},
		pause: () => {},
		seek: () => {},
		playlistItem: () => ({ id: 1399, type: 'tv', tmdbId: 1399 }),
		currentTrack: () => ({ id: 4821 }),
	};
}

const DPadHost = defineComponent({
	setup() {
		useDPad({ back: () => {}, currentRoute: { value: { name: 'home' } } } as never);
		return () => h('div');
	},
});

describe('the receiver payload, built by the real recorders', () => {
	beforeEach(() => {
		diagnosticsRing.clear();
		authStore.serverUrl.value = 'https://media.example.test';
	});

	afterEach(() => {
		videoSyncBridge.detach();
		musicSyncBridge.detach();
		vi.unstubAllGlobals();
	});

	it('records a whole session and renders a report of hundreds of lines with no title in it', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

		// Navigation, as the real router guard records it.
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.ScreenOpened, 0, 0, 0, 'home');
		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.CastSessionStarted, 0, 0, 0, 'cast-session watch-tv');

		// Every request, through the real client.
		for (const path of ['/api/v1/home', '/api/v1/libraries/8821', 'userData/continue', '/api/v1/search?query=the+matrix'])
			await apiFetch({ path });

		// Every engine event, through the real bridges.
		const video = fakeEngine();
		const music = fakeEngine();
		videoSyncBridge.attach(video as never);
		musicSyncBridge.attach(music as never);

		// The bridges' own outbound handlers expect their real payload shapes.
		// This drives the diagnostics recorder, not those handlers, so a shape
		// they reject is caught here rather than modelled.
		for (const event of ALL_PLAYER_EVENTS) {
			for (const engine of [video, music]) {
				try {
					engine.emit(event, { time: 90 });
				}
				catch {
					// the recorder already ran
				}
			}
		}

		// Every key, through the real D-pad composable.
		const host = mount(DPadHost);
		for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'KeyQ'])
			window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
		host.unmount();

		// Every error the receiver swallows.
		const fakeConsole = { error: vi.fn(), warn: vi.fn() } as unknown as Console;
		installDiagnosticsConsoleTap(fakeConsole);
		fakeConsole.warn('[cast] navigate message carried no token');
		fakeConsole.error('[cast] handshake failed', new TypeError('bad'));

		recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.CastSessionEnded, 0, 0, 0, 'cast-session shutdown');

		const entries = diagnosticsRing.snapshot();
		const report = renderDiagnosticsReport(collectDeviceFacts(), entries, 0);
		const lines = report.split('\n');

		// Two engines times the whole kit event set, plus navigation, requests,
		// keys and swallowed errors. Twenty lines is what this replaced.
		expect(lines.length).toBeGreaterThan(250);
		expect(report).not.toContain('The Matrix');
		expect(report).not.toContain('the+matrix');
		expect(report).toContain('GET /api/v1/search?query=');
		expect(report).toContain('GET /userData/continue');
		expect(report).toContain('Input KeyPressed KeyQ');
		expect(report).toContain('Lifecycle CastSessionStarted cast-session watch-tv');
		expect(report).toContain('Lifecycle CastSessionEnded cast-session shutdown');
		expect(report).toContain('Lifecycle ErrorCaught TypeError');
		expect(report).toContain('Playback PlaybackStalled stalled tv-1399');
		expect(report).toContain('Input InputAction subtitle');
	});
});
