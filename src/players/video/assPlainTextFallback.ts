import type { NMVideoPlayer } from '@nomercy-entertainment/nomercy-video-player';
import { authStore } from '@/stores/authStore';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';

export interface AssCue { start: number; end: number; text: string }

export interface AssFallbackOptions {
	timeoutMs?: number;
	fetchText?: (url: string) => Promise<string>;
}

type FallbackPlayer = Pick<NMVideoPlayer, 'on' | 'off' | 'container' | 'subtitles' | 'time'>;

const RENDER_TIMEOUT_MS = 8000;
const LOAD_FAILED = 'plugin:octopus/load-failed';
const RENDER_ERROR = 'plugin:octopus/render-error';

function clock(value: string): number {
	const [hours, minutes, seconds] = value.trim().split(':');
	return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// Dialogue lines only; override blocks like {\an8\b1} and drawing commands go.
export function parseAssPlainText(source: string): AssCue[] {
	const cues: AssCue[] = [];
	for (const line of source.replace(/\r/g, '').split('\n')) {
		if (!line.startsWith('Dialogue:'))
			continue;
		const fields = line.slice('Dialogue:'.length).split(',');
		const text = fields.slice(9).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ').trim();
		const start = clock(fields[1] ?? '');
		const end = clock(fields[2] ?? '');
		if (text && Number.isFinite(start) && Number.isFinite(end) && end > start)
			cues.push({ start, end, text });
	}
	return cues;
}

const STYLED_URL = /\.(?:ass|ssa)(?:[?#]|$)/i;

function isStyled(url: string): boolean {
	return STYLED_URL.test(url);
}

async function fetchWithToken(url: string): Promise<string> {
	const token = authStore.accessToken.value;
	const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
	if (!response.ok)
		throw new Error(`subtitle fetch ${response.status}`);
	return response.text();
}

/**
 * Shows a styled (ASS) track as plain text when the libass renderer cannot
 * run: it reported a failure, or stayed silent past the timeout (a worker 404
 * reports nothing). Returns the detach function.
 */
export function attachAssPlainTextFallback(player: FallbackPlayer, options: AssFallbackOptions = {}): () => void {
	const fetchText = options.fetchText ?? fetchWithToken;
	const timeoutMs = options.timeoutMs ?? RENDER_TIMEOUT_MS;
	const on = player.on.bind(player) as (event: string, handler: (data?: unknown) => void) => void;
	const off = player.off.bind(player) as (event: string, handler: (data?: unknown) => void) => void;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let styledUrl: string | null = null;
	let cues: AssCue[] = [];
	let box: HTMLElement | null = null;
	let epoch = 0;

	function clearTimer(): void {
		if (timer !== null)
			clearTimeout(timer);
		timer = null;
	}

	function clearText(): void {
		box?.remove();
		box = null;
		cues = [];
	}

	function paint(): void {
		const now = player.time();
		const cue = cues.filter(entry => now >= entry.start && now < entry.end).map(entry => entry.text).join('\n');
		if (!box)
			return;
		box.textContent = cue;
	}

	async function activate(): Promise<void> {
		clearTimer();
		if (!styledUrl || box)
			return;
		const mine = epoch;
		try {
			const parsed = parseAssPlainText(await fetchText(styledUrl));
			if (mine !== epoch)
				return;
			cues = parsed;
			box = document.createElement('div');
			box.className = 'ass-plain-text';
			box.setAttribute('aria-live', 'off');
			player.container.append(box);
			paint();
		}
		catch (error) {
			recordSwallowed('assPlainTextFallback', error);
		}
	}

	const onSubtitle = (data?: unknown): void => {
		epoch++;
		clearTimer();
		clearText();
		styledUrl = null;
		const track = (data as { track?: number | null } | undefined)?.track;
		if (typeof track !== 'number' || track < 0)
			return;
		const url = player.subtitles()[track]?.url;
		if (!url || !isStyled(url))
			return;
		styledUrl = url;
		timer = setTimeout(() => void activate(), timeoutMs);
	};
	const onReady = (): void => clearTimer();
	const onWarning = (data?: unknown): void => {
		const code = (data as { error?: { code?: string } } | undefined)?.error?.code;
		if (code === LOAD_FAILED || code === RENDER_ERROR)
			void activate();
	};

	on('subtitle', onSubtitle);
	on('plugin:octopus:renderer:ready', onReady);
	on('plugin:warning', onWarning);
	on('time', paint);

	return () => {
		epoch++;
		clearTimer();
		clearText();
		off('subtitle', onSubtitle);
		off('plugin:octopus:renderer:ready', onReady);
		off('plugin:warning', onWarning);
		off('time', paint);
	};
}
