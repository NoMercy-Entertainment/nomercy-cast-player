/**
 * SkipChapterPrompt — minimal "Skip intro" / "Skip credits" pill that
 * appears at the bottom-right while the playhead is inside a skippable
 * chapter and auto-skip is disabled. Mirrors APK
 * SkipChapterButton.kt — focusable, dismissed when the chapter ends or
 * the user explicitly skips.
 *
 * DOM-driven, mounted lazily by TVOverlayPlugin when
 * 'chapter-skip-available' fires.
 */

export interface SkipChapterPromptOptions {
	parent: HTMLElement;
	label: string;
	onSkip: () => void;
}

export interface SkipChapterPromptHandle {
	focus: () => void;
	dispose: () => void;
}

export function mountSkipChapterPrompt(opts: SkipChapterPromptOptions) {
	const btn = document.createElement('button');

	btn.type = 'button';
	btn.className = 'panel-button panel-button-secondary skip-chapter-prompt';
	btn.dataset.focusable = 'true';
	btn.tabIndex = 0;
	btn.textContent = opts.label;

	btn.addEventListener('click', () =>
		opts.onSkip());

	btn.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			opts.onSkip();
		}
	});

	opts.parent.append(btn);

	return {
		focus: () => btn.focus(),
		dispose: () => btn.remove(),
	} as const satisfies SkipChapterPromptHandle;
}
