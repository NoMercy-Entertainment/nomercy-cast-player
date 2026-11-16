import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachMessageBus } from './messageBus';
import type { JsonValue } from './messageBus';
import type { buildDiagnosticsAnswer } from './diagnosticsAnswer';
import { NAMESPACE_GENERAL } from './namespaces';
import { recordDiagnostic } from '@/lib/diagnostics/sink';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { authStore } from '@/stores/authStore';
import { installCrashHandlers } from '@/lib/diagnostics/crashHandler';

type Context = Parameters<typeof attachMessageBus>[0];
type Listener = Parameters<Context['addCustomMessageListener']>[1];
type Send = (namespace: string, senderId: string | undefined, data: unknown) => void;
type Diagnostics = ReturnType<typeof buildDiagnosticsAnswer>;

function isDiagnosticsReply(message: unknown): message is { diagnostics: Diagnostics } {
	return typeof message === 'object' && message !== null && 'diagnostics' in message;
}

function fakeContext() {
	const listeners = new Map<string, Listener>();
	const sendCustomMessage = vi.fn<Send>();

	attachMessageBus({
		addCustomMessageListener: (ns, fn) => listeners.set(ns, fn),
		sendCustomMessage,
	});

	return {
		ask: (data: JsonValue) => listeners.get(NAMESPACE_GENERAL)!({ senderId: 'probe', data }),
		sendCustomMessage,
		/** The diagnostics the receiver answered with. */
		answer: (): Diagnostics => {
			const message = sendCustomMessage.mock.calls[0]?.[2];

			if (!isDiagnosticsReply(message))
				throw new Error('the receiver sent no diagnostics answer');

			return message.diagnostics;
		},
	};
}

describe('a sender asks the receiver for its diagnostics (a TV has no DevTools)', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		authStore.accessToken.value = null;
	});

	it('answers the asking sender with the player state, codec support and recent events', () => {
		document.body.innerHTML = '<video></video>';
		recordDiagnostic(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested, 0, 0, 0, 'tv-60808');
		const { ask, sendCustomMessage, answer } = fakeContext();

		ask({ diagnostics: true });

		expect(sendCustomMessage).toHaveBeenCalledTimes(1);
		const [ns, sender] = sendCustomMessage.mock.calls[0]!;
		const diagnostics = answer();

		expect(ns).toBe(NAMESPACE_GENERAL);
		expect(sender).toBe('probe');
		expect(diagnostics.route).toBe(window.location.pathname);
		expect(diagnostics.videos).toHaveLength(1);

		expect(diagnostics.videos[0]).toEqual(expect.objectContaining({
			paused: true,
			currentTime: 0,
			error: null,
		}));

		expect(Object.keys(diagnostics.codecs)).toEqual(expect.arrayContaining([
			'video/mp4; codecs="hvc1.2.4.L120.B0"',
			'video/mp4; codecs="avc1.640028"',
		]));

		expect(diagnostics.events.at(-1)).toEqual(expect.objectContaining({ code: 'SourceRequested' }));
	});

	it('reports the overlay time text the viewer sees (a screencap misses it on a TV)', () => {
		document.body.innerHTML = [
			'<div class="tvui-root"><div class="tvui-bottom-bar">',
			'<span class="tvui-time">2:04</span>',
			'<span class="tvui-time tvui-dim">21:58</span>',
			'</div></div>',
		].join('');

		const { ask, answer } = fakeContext();

		ask({ diagnostics: true });

		expect(answer().osd).toEqual({
			visible: true,
			elapsed: '2:04',
			remaining: '21:58',
		});
	});

	it('reports the overlay as hidden while its controls are away', () => {
		document.body.innerHTML = '<div class="tvui-root"><span class="tvui-sr"></span></div>';
		const { ask, answer } = fakeContext();

		ask({ diagnostics: true });

		expect(answer().osd).toEqual({
			visible: false,
			elapsed: null,
			remaining: null,
		});
	});

	it('reports no overlay when the player has none mounted', () => {
		const { ask, answer } = fakeContext();

		ask({ diagnostics: true });

		expect(answer().osd).toBeNull();
	});

	it('never puts the access token in the answer', () => {
		authStore.accessToken.value = 'secret-placeholder-token';
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		const sent = JSON.stringify(sendCustomMessage.mock.calls[0]![2]);

		expect(sent).not.toContain('secret-placeholder-token');
	});

	it('names the pending crash: class, message and the first 5 stack lines, without a query string', () => {
		installCrashHandlers();
		const secret = 'secret-placeholder-token';
		const error = new TypeError(`cannot read x of https://example.com/api?access_token=${secret}`);

		const frames = Array.from({ length: 8 }, (_, i) =>
			`    at frame${i} (https://example.com/assets/app.js?v=${secret}:1:${i})`);

		error.stack = ['TypeError: cannot read x', ...frames].join('\n');

		window.dispatchEvent(new ErrorEvent('error', { error }));
		const { ask, sendCustomMessage, answer } = fakeContext();

		ask({ diagnostics: true });

		const crash = answer().crashes.at(-1);

		expect(crash?.name).toBe('TypeError');
		expect(crash?.message).toContain('cannot read x');
		expect(crash?.stack.split('\n')).toHaveLength(5);
		expect(crash?.stack).toContain('frame3');
		expect(crash?.stack).not.toContain('frame4');
		expect(JSON.stringify(sendCustomMessage.mock.calls[0]![2])).not.toContain(secret);
	});

	// devP: the pre-screen mounted yet unseen; a screencap cannot say what covers what.
	it('reports each screen layer: how many match, and each one\'s classes, z-index, opacity and display', () => {
		document.body.innerHTML = [
			'<div class="tvui-bottom-bar" style="z-index: 5"></div>',
			'<div class="tvui-bottom-bar" style="z-index: 7"></div>',
			'<div class="tvui-dialog tvui-pre-screen" style="opacity: 0; z-index: 3">',
			'<div class="tvui-pre-buttons"><button>Play</button></div></div>',
			'<div class="nm-hero-rails-screen" style="display: none"></div>',
		].join('');

		const { ask, answer } = fakeContext();

		ask({ diagnostics: true });

		const { layers } = answer();

		expect(layers['.tvui-bottom-bar']?.count).toBe(2);
		expect(layers['.tvui-bottom-bar']?.items.map((item) => item.zIndex)).toEqual(['5', '7']);

		expect(layers['.tvui-pre-screen']?.items[0]).toEqual(expect.objectContaining({
			className: 'tvui-dialog tvui-pre-screen',
			opacity: '0',
			zIndex: '3',
			children: 1,
		}));

		expect(layers['.tvui-pre-buttons button']?.count).toBe(1);
		expect(layers['.nm-hero-rails-screen']?.items[0]?.display).toBe('none');
		expect(layers['.empty-state']?.count).toBe(0);
	});

	// devAA: keys reached the page but nothing showed where focus went; a screencap of this TV is stale.
	it('reports the focused element: tag, classes, data ids and a short label', () => {
		const label = 'Made-up Artist with a very long name that keeps going on and on';

		document.body.innerHTML = [
			'<article class="music-home-card nm-focus-scale-sm" data-focusable',
			` data-rail-id="favorites" tabindex="0" aria-label="${label}"></article>`,
		].join('');

		document.querySelector<HTMLElement>('article')!.focus();
		const { ask, answer } = fakeContext();

		ask({ diagnostics: true });

		expect(answer().focus).toEqual({
			tag: 'article',
			className: 'music-home-card nm-focus-scale-sm',
			data: { focusable: '', railId: 'favorites' },
			label: 'Made-up Artist with a very long name th',
		});
	});

	it('reports focus on the body as nothing focused', () => {
		const { ask, answer } = fakeContext();

		ask({ diagnostics: true });

		expect(answer().focus).toBeNull();
	});

	it('reports no crashes when none was recorded (positive control: the field is there)', () => {
		const { ask, answer } = fakeContext();

		ask({ diagnostics: true });

		expect(Array.isArray(answer().crashes)).toBe(true);
	});
});
