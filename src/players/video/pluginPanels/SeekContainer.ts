/**
 * SeekContainer — wakes on Left/Right arrow during playback, shows a
 * scrubbing strip with thumbnails, commits the seek on Enter. Mirrors
 * tvUIPlugin.ts:createSeekContainer in the archived implementation.
 *
 * Phase 9 ships a minimal version: progress bar with current/preview
 * markers, +/- 10s scrub increments per arrow press. Thumbnail strip
 * comes once we have a working preview-thumbnail source on the receiver
 * (the existing PreviewThumbnailsPlugin needs porting in v1.1).
 */

interface SeekContainerOptions {
	parent: HTMLElement;
	getCurrentTime: () => number;
	getDuration: () => number;
	onCommit: (seconds: number) => void;
	onCancel: () => void;
}

export function mountSeekContainer(opts: SeekContainerOptions): () => void {
	const root = document.createElement('div');

	root.className = 'panel seek-container';

	let scrub = opts.getCurrentTime();
	const duration = opts.getDuration();

	const bar = document.createElement('div');

	bar.className = 'seek-bar';
	const fill = document.createElement('div');

	fill.className = 'seek-fill';
	bar.append(fill);

	const time = document.createElement('span');

	time.className = 'seek-time';

	function render(): void {
		const pct = duration > 0
			? Math.min(100, (scrub / duration) * 100)
			: 0;

		fill.style.width = `${pct}%`;
		time.textContent = `${fmt(scrub)} / ${fmt(duration)}`;
	}

	render();

	root.append(time, bar);
	opts.parent.append(root);

	const onKey = (e: KeyboardEvent): void => {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			scrub = Math.max(0, scrub - 10);
			render();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			scrub = Math.min(duration, scrub + 10);
			render();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			opts.onCommit(scrub);
		} else if (
			e.key === 'Escape' ||
			e.key === 'Back' ||
			e.key === 'GoBack' ||
			e.key === 'BrowserBack'
		) {
			e.preventDefault();
			opts.onCancel();
		}
	};

	window.addEventListener('keydown', onKey, true);

	return (): void => {
		window.removeEventListener('keydown', onKey, true);
		root.remove();
	};
}

function fmt(seconds: number): string {
	const total = Math.max(0, Math.round(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;

	if (h > 0)
		return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

	return `${m}:${s.toString().padStart(2, '0')}`;
}
