/**
 * PlaybackOSD — on-screen display rendered during active playback.
 * Shows the show/movie title, current item subtitle, big progress bar
 * with chapter markers, and elapsed / remaining timestamps. Mirrors APK
 * TvUiPlugin's idle-controls layer (the lower band that surfaces while
 * controls are visible).
 *
 * DOM-driven, mounted once per Watch session and updated in place via
 * the public update() return.
 */

export interface PlaybackOSDOptions {
	parent: HTMLElement;
	title: string;
	subtitle?: string | null;
	getCurrentTime: () => number;
	getDuration: () => number;
	chapters?: Array<{ start: number; end?: number }>;
}

export interface PlaybackOSDHandle {
	setTitle: (next: { title: string; subtitle?: string | null }) => void;
	setChapters: (next: Array<{ start: number; end?: number }>) => void;
	setMessage: (text: string) => void;
	setVisible: (visible: boolean) => void;
	dispose: () => void;
}

export function mountPlaybackOSD(opts: PlaybackOSDOptions) {
	const root = document.createElement('div');

	root.className = 'playback-osd is-visible';
	root.setAttribute('role', 'presentation');

	const titleRow = document.createElement('div');

	titleRow.className = 'osd-title-row';
	const subtitleEl = document.createElement('p');

	subtitleEl.className = 'osd-subtitle';
	subtitleEl.textContent = opts.subtitle ?? '';

	if (!opts.subtitle?.trim()) {
		subtitleEl.style.display = 'none';
	}

	const titleEl = document.createElement('h2');

	titleEl.className = 'osd-title';
	titleEl.textContent = opts.title;
	titleRow.append(subtitleEl, titleEl);

	const progressRow = document.createElement('div');

	progressRow.className = 'osd-progress-row';
	const elapsedEl = document.createElement('span');

	elapsedEl.className = 'osd-time osd-elapsed';
	const barWrap = document.createElement('div');

	barWrap.className = 'osd-bar';
	const fill = document.createElement('div');

	fill.className = 'osd-bar-fill';
	const chapterLayer = document.createElement('div');

	chapterLayer.className = 'osd-bar-chapters';
	const thumb = document.createElement('div');

	thumb.className = 'osd-bar-thumb';
	barWrap.append(chapterLayer, fill, thumb);
	const remainingEl = document.createElement('span');

	remainingEl.className = 'osd-time osd-remaining';
	progressRow.append(elapsedEl, barWrap, remainingEl);

	root.append(titleRow, progressRow);
	opts.parent.append(root);

	// TVTopBar.kt:67-180: a top band with the title over the episode line.
	const topBar = document.createElement('div');

	topBar.className = 'playback-osd-top is-visible';
	topBar.setAttribute('role', 'presentation');
	const topTitleEl = document.createElement('p');

	topTitleEl.className = 'osd-top-title';
	topTitleEl.textContent = opts.title;
	const topSubtitleEl = document.createElement('p');

	topSubtitleEl.className = 'osd-top-subtitle';
	topSubtitleEl.textContent = opts.subtitle ?? '';

	if (!opts.subtitle?.trim()) {
		topSubtitleEl.style.display = 'none';
	}

	topBar.append(topTitleEl, topSubtitleEl);

	// CenterMessage.kt:33-44: a short message under the top edge.
	const messageEl = document.createElement('div');

	messageEl.className = 'osd-center-message';
	messageEl.setAttribute('role', 'status');
	opts.parent.append(topBar, messageEl);

	let chapters = opts.chapters ?? [];
	let visible = true;
	let raf: number | null = null;

	const fmt = (sec: number): string => {
		const total = Math.max(0, Math.round(sec));
		const h = Math.floor(total / 3600);
		const m = Math.floor((total % 3600) / 60);
		const s = total % 60;

		if (h > 0)
			return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

		return `${m}:${s.toString().padStart(2, '0')}`;
	};

	const renderChapters = (): void => {
		chapterLayer.innerHTML = '';
		const duration = opts.getDuration();

		if (duration <= 0) return;

		for (const c of chapters) {
			if (c.start <= 0) continue;

			const tick = document.createElement('span');

			tick.className = 'osd-chapter-tick';
			tick.style.left = `${(c.start / duration) * 100}%`;
			chapterLayer.append(tick);
		}
	};

	const tick = (): void => {
		if (!visible) {
			raf = null;

			return;
		}

		const t = opts.getCurrentTime();
		const d = opts.getDuration();

		if (d > 0) {
			fill.style.width = `${Math.min(100, (t / d) * 100)}%`;
			thumb.style.left = fill.style.width;
			elapsedEl.textContent = fmt(t);
			remainingEl.textContent = `-${fmt(Math.max(0, d - t))}`;
		}

		raf = requestAnimationFrame(tick);
	};

	renderChapters();
	tick();

	return {
		setTitle: (next) => {
			titleEl.textContent = next.title;
			subtitleEl.textContent = next.subtitle ?? '';

			subtitleEl.style.display = next.subtitle?.trim()
				? ''
				: 'none';

			topTitleEl.textContent = next.title;
			topSubtitleEl.textContent = next.subtitle ?? '';

			topSubtitleEl.style.display = next.subtitle?.trim()
				? ''
				: 'none';
		},
		setMessage: (text) => {
			messageEl.textContent = text;
			messageEl.classList.toggle('is-visible', text.length > 0);
		},
		setChapters: (next) => {
			chapters = next;
			renderChapters();
		},
		setVisible: (next) => {
			if (visible === next) return;

			visible = next;
			root.classList.toggle('is-visible', next);
			topBar.classList.toggle('is-visible', next);

			if (next && raf === null) {
				tick();
			}
		},
		dispose: () => {
			if (raf !== null) {
				cancelAnimationFrame(raf);
			}

			root.remove();
			topBar.remove();
			messageEl.remove();
		},
	} as const satisfies PlaybackOSDHandle;
}
