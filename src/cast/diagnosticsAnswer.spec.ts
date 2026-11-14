import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachMessageBus } from './messageBus';
import { NAMESPACE_GENERAL } from './namespaces';
import { recordDiagnostic } from '@/lib/diagnostics/sink';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { authStore } from '@/stores/authStore';

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

	it('never puts the access token in the answer', () => {
		authStore.accessToken.value = 'secret-placeholder-token';
		const { ask, sendCustomMessage } = fakeContext();

		ask({ diagnostics: true });

		expect(JSON.stringify(sendCustomMessage.mock.calls[0]![2])).not.toContain('secret-placeholder-token');
	});
});
