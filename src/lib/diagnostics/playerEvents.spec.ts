import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_PLAYER_EVENTS, attachEngineDiagnostics } from './playerEvents';
import type { DiagnosticsEngine } from './playerEvents';
import { diagnosticsRing } from './sink';

function fakeEngine(): { engine: DiagnosticsEngine; emit: (event: string, payload?: unknown) => void } {
	const handlers = new Map<string, Array<(...args: unknown[]) => void>>();

	return {
		engine: {
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
		},
		emit: (event, payload) => {
			for (const handler of [...(handlers.get(event) ?? [])])
				handler(payload);
		},
	};
}

describe('the receiver subscribes to every engine event', () => {
	beforeEach(() => {
		diagnosticsRing.clear();
	});

	it('subscribes to the whole event set, not a shortlist', () => {
		const { engine } = fakeEngine();
		const unsubs: Array<() => void> = [];

		// `time` is the per-frame clock and is the one deliberate exclusion.
		expect(attachEngineDiagnostics(engine, () => undefined, unsubs)).toBe(ALL_PLAYER_EVENTS.length - 1);
	});

	it('records seams the old four-event list never carried', () => {
		const { engine, emit } = fakeEngine();
		attachEngineDiagnostics(engine, () => 'tv-1399', []);

		emit('seeked', { time: 90 });
		emit('qualityState', { level: 4 });
		emit('subtitle', { lang: 'eng' });

		expect(diagnosticsRing.snapshot().map(entry => `${entry.code} ${entry.label}`)).toEqual([
			'PlayerEvent seeked tv-1399',
			'PlayerEvent qualityState tv-1399',
			'InputAction subtitle eng tv-1399',
		]);
	});

	it('puts a number the payload carried into field b', () => {
		const { engine, emit } = fakeEngine();
		attachEngineDiagnostics(engine, () => undefined, []);

		emit('seeked', { time: 90 });

		expect(diagnosticsRing.snapshot()[0].b).toBe(90);
	});

	it('hands every subscription back so a detach tears all of them down', () => {
		const { engine, emit } = fakeEngine();
		const unsubs: Array<() => void> = [];

		attachEngineDiagnostics(engine, () => undefined, unsubs);
		unsubs.forEach(unsub => unsub());
		diagnosticsRing.clear();

		emit('stalled');

		expect(diagnosticsRing.snapshot()).toHaveLength(0);
	});
});
