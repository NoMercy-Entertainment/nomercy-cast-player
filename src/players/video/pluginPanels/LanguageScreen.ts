/**
 * LanguageScreen panel — quality / audio / subtitles / playback toggles.
 * Mirrors APK LanguageDialog: a row of weighted columns, each a vertical
 * track list. Quality column is hidden when only one quality level is
 * available, matching the APK behaviour.
 *
 * Pure DOM module — mounted directly into the player overlay element by
 * the npm video-player package, no Vue runtime needed inside the panel.
 */

import { dispatchOptionAction } from './shared';

export interface TrackItem {
	id: string | number;
	label: string;
}

export interface LanguageScreenOptions {
	parent: HTMLElement;
	audioTracks: TrackItem[];
	subtitleTracks: TrackItem[];
	qualityLevels?: TrackItem[];
	currentAudioId?: string | number | null;
	currentSubtitleId?: string | number | null;
	currentQualityId?: string | number | null;
	autoQualityLabel?: string | null;
	autoSkipChapters?: boolean;
	onPickAudio: (id: string | number) => void;
	onPickSubtitle: (id: string | number) => void;
	onPickQuality?: (id: string | number) => void;
	onToggleAutoSkip?: (next: boolean) => void;
	onExit: () => void;
}

export function mountLanguageScreen(opts: LanguageScreenOptions): () => void {
	const root = document.createElement('div');
	root.className = 'panel language-screen';
	root.setAttribute('role', 'dialog');
	root.setAttribute('aria-label', 'Audio and subtitles');

	const layout = document.createElement('div');
	layout.className = 'language-layout';

	const showQuality = (opts.qualityLevels?.length ?? 0) > 1 && Boolean(opts.onPickQuality);
	if (showQuality) {
		const qualityCol = makeColumn(
			'Quality',
			[
				{
					id: -1 as string | number,
					label: opts.autoQualityLabel ? `Auto (${opts.autoQualityLabel})` : 'Auto',
				},
				...(opts.qualityLevels ?? []),
			],
			opts.currentQualityId ?? -1,
			id => opts.onPickQuality?.(id),
		);
		layout.append(qualityCol);
	}

	const audioCol = makeColumn(
		'Audio',
		opts.audioTracks,
		opts.currentAudioId ?? null,
		id => opts.onPickAudio(id),
	);
	const subsCol = makeColumn(
		'Subtitles',
		[{ id: 'off', label: 'Off' }, ...opts.subtitleTracks],
		opts.currentSubtitleId ?? 'off',
		id => opts.onPickSubtitle(id),
	);
	// A source with a single audio stream reports none to choose from; an
	// empty Audio heading beside the subtitles reads as broken.
	if (opts.audioTracks.length > 0)
		layout.append(audioCol);
	layout.append(subsCol);

	if (opts.onToggleAutoSkip) {
		const playbackCol = document.createElement('section');
		playbackCol.className = 'lang-section';
		const heading = document.createElement('h3');
		heading.textContent = 'Playback';
		playbackCol.append(heading);

		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = `panel-button track-row${opts.autoSkipChapters ? ' current' : ''}`;
		toggle.dataset.focusable = 'true';
		toggle.tabIndex = 0;
		toggle.textContent = 'Auto-skip intros and outros';
		toggle.addEventListener('click', () => {
			const next = !toggle.classList.contains('current');
			toggle.classList.toggle('current', next);
			opts.onToggleAutoSkip?.(next);
		});
		playbackCol.append(toggle);
		layout.append(playbackCol);
	}

	root.append(layout);
	opts.parent.append(root);

	requestAnimationFrame(() => {
		const target = layout.querySelector<HTMLElement>('.track-row.current')
			?? layout.querySelector<HTMLElement>('[data-focusable]');
		target?.focus();
	});

	const onKey = (e: KeyboardEvent): void => {
		if (e.key === 'Escape' || e.key === 'Back' || e.key === 'GoBack' || e.key === 'BrowserBack') {
			e.preventDefault();
			opts.onExit();
			return;
		}
		const active = document.activeElement;
		if (!active)
			return;
		const currentSection = (active as HTMLElement).closest<HTMLElement>('.lang-section');
		if (!currentSection)
			return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			const sections = [...layout.querySelectorAll<HTMLElement>('.lang-section')];
			const idx = sections.indexOf(currentSection);
			const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
			if (nextIdx >= 0 && nextIdx < sections.length) {
				e.preventDefault();
				const target = sections[nextIdx].querySelector<HTMLElement>('.track-row.current')
					?? sections[nextIdx].querySelector<HTMLElement>('[data-focusable]');
				target?.focus();
			}
		}
	};
	root.addEventListener('keydown', onKey, true);
	for (const section of layout.querySelectorAll<HTMLElement>('.lang-section'))
		dispatchOptionAction(root, section, 'vertical');

	return (): void => {
		root.removeEventListener('keydown', onKey, true);
		root.remove();
	};
}

function makeColumn(
	label: string,
	tracks: TrackItem[],
	currentId: string | number | null,
	onPick: (id: string | number) => void,
): HTMLElement {
	const wrap = document.createElement('section');
	wrap.className = 'lang-section';

	const h = document.createElement('h3');
	h.textContent = label;
	wrap.append(h);

	for (const t of tracks) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'panel-button track-row';
		btn.dataset.focusable = 'true';
		btn.tabIndex = 0;
		if (t.id === currentId)
			btn.classList.add('current');
		btn.textContent = t.label;
		btn.addEventListener('click', () => {
			onPick(t.id);
			// The panel stays open after a pick, so the mark has to move with
			// it or the old choice still reads as the active one.
			for (const row of wrap.querySelectorAll('.track-row.current'))
				row.classList.remove('current');
			btn.classList.add('current');
		});
		wrap.append(btn);
	}

	return wrap;
}
