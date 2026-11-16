/**
 * PreScreen panel — pre-play screen with Play / Restart / Episodes /
 * Audio+subs buttons. Mounted as a fullscreen overlay over the video
 * element when the player isn't actively playing. Mirrors APK Leanback
 * watch pre-play presentation (TvUiPlugin's idle state).
 *
 * Visual notes (matched against APK):
 *   - Backdrop image full-bleed with bottom-up gradient scrim.
 *   - Title in display style top-left, synopsis 6-line clamped below.
 *   - Watch / Restart / Episodes / Audio+subs buttons in a focus row.
 *
 * DOM-driven (not Vue) so the npm video-player package can mount it
 * directly into the player overlay element without a nested Vue app.
 */

import i18next from '@/i18n/i18next';
import { dispatchOptionAction } from './shared';

export interface PreScreenOptions {
	parent: HTMLElement;
	title: string;
	subtitle?: string;
	overview?: string;
	backdropUrl?: string | null;
	showEpisodes: boolean;
	showLanguages: boolean;
	resumeFromMs?: number;
	onPlay: () => void;
	onRestart: () => void;
	onShowEpisodes: () => void;
	onShowLanguages: () => void;
	onExit: () => void;
}

export function mountPreScreen(opts: PreScreenOptions): () => void {
	const root = document.createElement('div');
	root.className = 'panel pre-screen';
	root.setAttribute('role', 'dialog');
	root.setAttribute('aria-label', i18next.t('player.pre_screen_aria'));

	if (opts.backdropUrl) {
		const backdrop = document.createElement('img');
		backdrop.className = 'pre-screen-backdrop';
		backdrop.src = opts.backdropUrl;
		backdrop.alt = '';
		backdrop.decoding = 'async';
		root.append(backdrop);

		const scrim = document.createElement('div');
		scrim.className = 'pre-screen-scrim';
		root.append(scrim);
	}

	const content = document.createElement('div');
	content.className = 'pre-screen-content';

	const subtitle = opts.subtitle?.trim();
	if (subtitle) {
		const subtitleEl = document.createElement('p');
		subtitleEl.className = 'pre-screen-subtitle';
		subtitleEl.textContent = subtitle;
		content.append(subtitleEl);
	}

	const title = document.createElement('h1');
	title.textContent = opts.title;
	title.className = 'pre-screen-title';
	content.append(title);

	const overview = opts.overview?.trim();
	if (overview) {
		const overviewEl = document.createElement('p');
		overviewEl.className = 'pre-screen-overview';
		overviewEl.textContent = overview;
		content.append(overviewEl);
	}

	const buttonRow = document.createElement('div');
	buttonRow.className = 'pre-screen-buttons';

	const resumeFrom = opts.resumeFromMs ?? 0;
	const playLabel = resumeFrom > 0 ? i18next.t('player.resume_from', { time: formatTime(resumeFrom) }) : i18next.t('common.play');
	const playBtn = makeButton(playLabel, 'primary', () => opts.onPlay());
	buttonRow.append(playBtn);

	if (resumeFrom > 0) {
		const restartBtn = makeButton(i18next.t('player.restart'), 'secondary', () => opts.onRestart());
		buttonRow.append(restartBtn);
	}
	if (opts.showEpisodes)
		buttonRow.append(makeButton(i18next.t('cast_remote.episodes'), 'secondary', () => opts.onShowEpisodes()));
	if (opts.showLanguages)
		buttonRow.append(makeButton(i18next.t('player.audio_and_subtitles'), 'secondary', () => opts.onShowLanguages()));

	content.append(buttonRow);
	root.append(content);
	opts.parent.append(root);

	requestAnimationFrame(() => playBtn.focus());

	const onKey = (e: KeyboardEvent): void => {
		if (e.key === 'Escape' || e.key === 'Back' || e.key === 'GoBack' || e.key === 'BrowserBack') {
			e.preventDefault();
			opts.onExit();
		}
	};
	root.addEventListener('keydown', onKey, true);

	dispatchOptionAction(root, buttonRow, 'horizontal');

	return (): void => {
		root.removeEventListener('keydown', onKey, true);
		root.remove();
	};
}

function makeButton(
	label: string,
	variant: 'primary' | 'secondary',
	onClick: () => void,
): HTMLButtonElement {
	const b = document.createElement('button');
	b.type = 'button';
	b.className = `panel-button panel-button-${variant}`;
	b.dataset.focusable = 'true';
	b.tabIndex = 0;
	b.textContent = label;
	b.addEventListener('click', () => onClick());
	return b;
}

function formatTime(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0)
		return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	return `${m}:${s.toString().padStart(2, '0')}`;
}
