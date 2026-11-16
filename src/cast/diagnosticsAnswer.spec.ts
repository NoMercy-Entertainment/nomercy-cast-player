import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachMessageBus } from './messageBus';
import { NAMESPACE_GENERAL } from './namespaces';
import { recordDiagnostic } from '@/lib/diagnostics/sink';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { authStore } from '@/stores/authStore';
import { installCrashHandlers } from '@/lib/diagnostics/crashHandler';

type Listener = (event: { senderId?: string; data: unknown }) => void;

function fakeContext() {
	const listeners = new Map<string, Listener>();
	const sendCustomMessage = vi.fn();
	attachMessageBus({ addCustomMessageListener: (ns, fn) => listeners.set(ns, fn), sendCustomMessage });
	return { ask: (data: unknown) => listeners.get(NAMESPACE_GENERAL)!({ senderId: 'probe', data }), sendCustomMessage };
}

describe('a sender asks the receiver for its diagnostics (a TV has no DevTools)', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		authStore.accessToken.value = null;
	});

	it('answers the asking sender with the player state, codec support and recent events', () => {
		document.body.innerHTML = '<video></video>';
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested, 0, 0, 0, 'tv-60808');
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(sendCustomMessage).toHaveBeenCalledTimes(1);
		const [ns, sender, answer] = sendCustomMessage.mock.calls[0]!;
		expect(ns).toBe(NAMESPACE_GENERAL);
		expect(sender).toBe('probe');
		expect(answer.diagnostics.route).toBe(window.location.pathname);
		expect(answer.diagnostics.videos).toHaveLength(1);
		expect(answer.diagnostics.videos[0]).toEqual(expect.objectContaining({ paused: true, currentTime: 0, error: null }));
		expect(Object.keys(answer.diagnostics.codecs)).toEqual(expect.arrayContaining(['video/mp4; codecs="hvc1.2.4.L120.B0"', 'video/mp4; codecs="avc1.640028"']));
		expect(answer.diagnostics.events.at(-1)).toEqual(expect.objectContaining({ code: 'SourceRequested' }));
	});

	it('reports the overlay time text the viewer sees (a screencap misses it on a TV)', () => {
		document.body.innerHTML = '<div class="playback-osd is-visible"><span class="osd-time osd-elapsed">2:04</span><span class="osd-time osd-remaining">-21:58</span></div>';
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(sendCustomMessage.mock.calls[0]![2].diagnostics.osd).toEqual({ visible: true, elapsed: '2:04', remaining: '-21:58' });
	});

	it('reports no overlay when the player has none mounted', () => {
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(sendCustomMessage.mock.calls[0]![2].diagnostics.osd).toBeNull();
	});

	it('never puts the access token in the answer', () => {
		authStore.accessToken.value = 'secret-placeholder-token';
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(JSON.stringify(sendCustomMessage.mock.calls[0]![2])).not.toContain('secret-placeholder-token');
	});

	it('names the pending crash: class, message and the first 5 stack lines, without a query string', () => {
		installCrashHandlers();
		const error = new TypeError('cannot read x of https://example.com/api?access_token=secret-placeholder-token');
		error.stack = ['TypeError: cannot read x', ...Array.from({ length: 8 }, (_, i) => `    at frame${i} (https://example.com/assets/app.js?v=secret-placeholder-token:1:${i})`)].join('\n');
		window.dispatchEvent(new ErrorEvent('error', { error }));
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		const answer = sendCustomMessage.mock.calls[0]![2];
		const crash = answer.diagnostics.crashes.at(-1);
		expect(crash.name).toBe('TypeError');
		expect(crash.message).toContain('cannot read x');
		expect(crash.stack.split('\n')).toHaveLength(5);
		expect(crash.stack).toContain('frame3');
		expect(crash.stack).not.toContain('frame4');
		expect(JSON.stringify(answer)).not.toContain('secret-placeholder-token');
	});

	// devP: Music was blank and the pre-screen mounted ("panel pre") yet unseen; a screencap cannot say what covers what.
	it('reports each screen layer: how many match, and each one\'s classes, z-index, opacity and display', () => {
		document.body.innerHTML = [
			'<div class="playback-osd is-visible" style="z-index: 5"></div>',
			'<div class="playback-osd is-visible" style="z-index: 7"></div>',
			'<div class="panel pre-screen" style="opacity: 0; z-index: 3"><div class="pre-screen-buttons"><button>Play</button></div></div>',
			'<div class="nm-hero-rails-screen" style="display: none"></div>',
		].join('');
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		const layers = sendCustomMessage.mock.calls[0]![2].diagnostics.layers;
		expect(layers['.playback-osd'].count).toBe(2);
		expect(layers['.playback-osd'].items.map((item: { zIndex: string }) => item.zIndex)).toEqual(['5', '7']);
		expect(layers['.pre-screen'].items[0]).toEqual(expect.objectContaining({ className: 'panel pre-screen', opacity: '0', zIndex: '3', children: 1 }));
		expect(layers['.pre-screen-buttons button'].count).toBe(1);
		expect(layers['.nm-hero-rails-screen'].items[0].display).toBe('none');
		expect(layers['.empty-state'].count).toBe(0);
	});

	// devAA: keys reached the page but nothing showed where focus went; a screencap of this TV is stale.
	it('reports the focused element: tag, classes, data ids and a short label', () => {
		document.body.innerHTML = '<article class="music-home-card nm-focus-scale-sm" data-focusable data-rail-id="favorites" tabindex="0" aria-label="Made-up Artist with a very long name that keeps going on and on"></article>';
		(document.querySelector('article') as HTMLElement).focus();
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(sendCustomMessage.mock.calls[0]![2].diagnostics.focus).toEqual({
			tag: 'article',
			className: 'music-home-card nm-focus-scale-sm',
			data: { focusable: '', railId: 'favorites' },
			label: 'Made-up Artist with a very long name th',
		});
	});

	it('reports focus on the body as nothing focused', () => {
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(sendCustomMessage.mock.calls[0]![2].diagnostics.focus).toBeNull();
	});

	it('reports no crashes when none was recorded (positive control: the field is there)', () => {
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(Array.isArray(sendCustomMessage.mock.calls[0]![2].diagnostics.crashes)).toBe(true);
	});
});
