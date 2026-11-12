import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachAssPlainTextFallback, parseAssPlainText } from './assPlainTextFallback';

type Handler = (data?: unknown) => void;

const ASS = [
	'[Script Info]',
	'Title: placeholder',
	'',
	'[Events]',
	'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
	'Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,{\\an8\\i1}Hello, {\\b1}world{\\b0}\\Nsecond line',
	'Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,Later',
].join('\n');

function fakePlayer(url = 'https://example.invalid/sub.eng.ass') {
	const handlers = new Map<string, Handler[]>();
	const container = document.createElement('div');
	let position = 0;
	return {
		container,
		on: vi.fn((event: string, handler: Handler) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		}),
		off: vi.fn((event: string, handler?: Handler) => {
			handlers.set(event, (handlers.get(event) ?? []).filter(entry => entry !== handler));
		}),
		subtitles: vi.fn(() => [{ id: 'sub-a', label: 'English', url }]),
		time: vi.fn(() => position),
		at: (seconds: number) => { position = seconds; },
		fire: (event: string, data?: unknown) => {
			for (const handler of [...(handlers.get(event) ?? [])])
				handler(data);
		},
	};
}

const warning = (code: string) => ({ error: { code }, severity: 'warning' });
const text = (container: HTMLElement) => container.querySelector('.ass-plain-text')?.textContent ?? null;

describe('parseAssPlainText', () => {
	it('strips override tags and turns \\N into a line break', () => {
		expect(parseAssPlainText(ASS)).toEqual([
			{ start: 1, end: 3.5, text: 'Hello, world\nsecond line' },
			{ start: 5, end: 6, text: 'Later' },
		]);
	});
});

describe('the plain-text fallback for a styled track', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it.each(['plugin:octopus/load-failed', 'plugin:octopus/render-error'])('shows the track as plain text on %s', async (code) => {
		const player = fakePlayer();
		attachAssPlainTextFallback(player as never, { fetchText: async () => ASS });
		player.fire('subtitle', { track: 0 });

		player.fire('plugin:warning', warning(code));
		await vi.advanceTimersByTimeAsync(0);
		player.at(2);
		player.fire('time');

		expect(text(player.container)).toBe('Hello, world\nsecond line');
		player.at(4);
		player.fire('time');
		expect(text(player.container)).toBe('');
	});

	it('shows the plain text when no renderer is ready in time, because a worker 404 reports nothing', async () => {
		const player = fakePlayer();
		attachAssPlainTextFallback(player as never, { fetchText: async () => ASS, timeoutMs: 5000 });
		player.fire('subtitle', { track: 0 });

		await vi.advanceTimersByTimeAsync(5000);
		player.at(5.5);
		player.fire('time');

		expect(text(player.container)).toBe('Later');
	});

	it('leaves the styled render alone once the renderer reports ready', async () => {
		const fetchText = vi.fn(async () => ASS);
		const player = fakePlayer();
		attachAssPlainTextFallback(player as never, { fetchText, timeoutMs: 5000 });
		player.fire('subtitle', { track: 0 });
		player.fire('plugin:octopus:renderer:ready', { url: 'x' });

		await vi.advanceTimersByTimeAsync(10000);
		player.at(2);
		player.fire('time');

		expect(fetchText).not.toHaveBeenCalled();
		expect(text(player.container)).toBeNull();
	});

	it('does nothing for a track that is not styled', async () => {
		const fetchText = vi.fn(async () => ASS);
		const player = fakePlayer('https://example.invalid/sub.eng.vtt');
		attachAssPlainTextFallback(player as never, { fetchText, timeoutMs: 5000 });
		player.fire('subtitle', { track: 0 });

		await vi.advanceTimersByTimeAsync(10000);

		expect(fetchText).not.toHaveBeenCalled();
	});

	it('clears the text when subtitles go off', async () => {
		const player = fakePlayer();
		attachAssPlainTextFallback(player as never, { fetchText: async () => ASS });
		player.fire('subtitle', { track: 0 });
		player.fire('plugin:warning', warning('plugin:octopus/load-failed'));
		await vi.advanceTimersByTimeAsync(0);
		player.at(2);
		player.fire('time');
		expect(text(player.container)).toBe('Hello, world\nsecond line');

		player.fire('subtitle', { track: null });

		expect(player.container.querySelector('.ass-plain-text')).toBeNull();
	});
});
