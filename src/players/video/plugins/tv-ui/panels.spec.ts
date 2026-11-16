import { describe, expect, it } from 'vitest';
import { centerMessage, loadingLayer } from './overlays';
import { bottomBar, settingsPanel } from './panels';
import type { Choice, SettingsData } from './panels';

const choice = (label: string, selected = false): Choice => ({
	label,
	selected,
	onPick: () => undefined,
});

function settingsData(overrides: Partial<SettingsData> = {}): SettingsData {
	return {
		nav: { pane: 'main', styleProp: null },
		levels: [choice('Auto', true), choice('1080p')],
		subtitles: [choice('Off', true), choice('Dutch')],
		audio: [choice('English', true), choice('Dutch')],
		hasQualityChoice: true,
		values: {
			quality: 'Auto',
			subtitle: 'Off',
			audio: 'English',
		},
		autoSkip: false,
		style: {
			font: 'Default',
			size: 24,
			edge: 'none',
			color: 'white',
			background: 0,
		},
		styleChoices: () => [choice('One', true), choice('Two')],
		open: () => undefined,
		onBack: () => undefined,
		onRestart: () => undefined,
		onToggleAutoSkip: () => undefined,
		onResetStyle: () => undefined,
		...overrides,
	};
}

const rowLabels = (root: HTMLElement): string[] =>
	Array.from(root.querySelectorAll('.tvui-sidebar-rows .tvui-row-label')).map((node) => node.textContent ?? '');

describe('bottom bar (TVBottomBar.kt, ChapterProgressBar.kt)', () => {
	const state = {
		playing: true,
		time: 30,
		duration: 100,
		buffered: 60,
		chapters: [{ start: 0, end: 50 }, { start: 50, end: 100 }],
	};

	it('b05a the elapsed readout shows the scrubbed time while the strip is open', () => {
		const bar = bottomBar(() => undefined);

		bar.update({ ...state, override: 75 });
		expect(bar.root.querySelector('.tvui-time')?.textContent).toBe('01:15');
	});

	it('b05b without an override the elapsed readout shows the playhead and the rest shows what is left', () => {
		const bar = bottomBar(() => undefined);

		bar.update(state);
		const times = Array.from(bar.root.querySelectorAll('.tvui-time')).map((node) => node.textContent);

		expect(times).toEqual(['00:30', '01:10']);
	});

	it('b05c the play button shows pause while playing and play while paused', () => {
		const bar = bottomBar(() => undefined);

		bar.update(state);
		expect(bar.root.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('pause');
		bar.update({ ...state, playing: false });
		expect(bar.root.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('play');
	});

	it('c20a the chapter bar has one segment per chapter, grown by its length', () => {
		const bar = bottomBar(() => undefined);

		bar.update({ ...state, chapters: [{ start: 0, end: 25 }, { start: 25, end: 100 }] });
		const grows = Array.from(bar.root.querySelectorAll<HTMLElement>('.tvui-chapter')).map((node) => node.style.flexGrow);

		expect(grows).toEqual(['0.25', '0.75']);
	});

	it('c20b a segment is filled up to the playhead and the buffered share is set on every segment', () => {
		const bar = bottomBar(() => undefined);

		bar.update(state);
		const fills = Array.from(bar.root.querySelectorAll<HTMLElement>('.tvui-chapter-fill')).map((node) => node.style.width);
		const buffered = Array.from(bar.root.querySelectorAll<HTMLElement>('.tvui-chapter')).map((node) => node.style.getPropertyValue('--buffered'));

		expect(fills).toEqual(['60%', '0%']);
		expect(buffered).toEqual(['60%', '60%']);
	});

	it('c20c without chapters one segment spans the whole duration', () => {
		const bar = bottomBar(() => undefined);

		bar.update({ ...state, chapters: [] });
		expect(bar.root.querySelectorAll('.tvui-chapter')).toHaveLength(1);
	});
});

describe('shared overlays (CenterMessage.kt, CastLoadingOverlay.kt)', () => {
	it('c19 the center message carries the text as a status', () => {
		const node = centerMessage('Subtitles off');

		expect(node.textContent).toBe('Subtitles off');
		expect(node.getAttribute('role')).toBe('status');
	});

	it('l01 the loading layer draws the item image, a spinner and two lines', () => {
		const node = loadingLayer('/one.jpg');

		expect(node.querySelector<HTMLElement>('.tvui-loading-art')?.style.backgroundImage).toContain('/one.jpg');
		expect(node.querySelector('.tvui-spinner')).not.toBeNull();
		expect(node.querySelector('.tvui-loading-title')?.textContent).toBe('Loading…');
		expect(node.querySelector('.tvui-loading-subtitle')?.textContent).toBe('Preparing playback');
	});
});

describe('settings panes (PlayerSettingsScreen.kt:128-173)', () => {
	it('p01a the main pane lists audio, subtitles, style, quality, auto-skip and restart in that order', () => {
		const { root } = settingsPanel(settingsData());

		expect(rowLabels(root)).toEqual(['Audio Tracks', 'Subtitle Tracks', 'Subtitle style', 'Quality', 'Auto-skip', 'Restart from beginning']);
	});

	it('p01b the main pane shows the current value of the rows that have one', () => {
		const { root } = settingsPanel(settingsData());
		const values = Array.from(root.querySelectorAll('.tvui-sidebar-rows .tvui-row-value')).map((node) => node.textContent);

		expect(values).toEqual(['English', 'Off', 'Auto', 'Off']);
	});

	it('p03c the quality row is disabled without a real choice and the audio row with one track', () => {
		const { root } = settingsPanel(settingsData({
			hasQualityChoice: false,
			audio: [choice('English', true)],
		}));

		const disabled = Array.from(root.querySelectorAll('.tvui-row[aria-disabled] .tvui-row-label')).map((node) => node.textContent);

		expect(disabled).toEqual(['Audio Tracks', 'Quality']);
	});

	it('p04b the first enabled row takes the initial focus', () => {
		const { root, focus } = settingsPanel(settingsData({ audio: [choice('English', true)] }));

		document.body.append(root);
		focus();
		expect(document.activeElement?.textContent).toContain('Subtitle Tracks');
		root.remove();
	});

	it('p09 each choice pane lists its choices with a check on the selected one', () => {
		for (const pane of ['quality', 'subtitle', 'audio'] as const) {
			const { root } = settingsPanel(settingsData({ nav: { pane, styleProp: null } }));
			const selected = root.querySelectorAll('.tvui-row.tvui-selected');

			expect(rowLabels(root)).toHaveLength(2);
			expect(selected).toHaveLength(1);
			expect(selected[0]?.querySelector('[data-icon="check"]')).not.toBeNull();
		}
	});

	it('p10 the style pane lists font, size, edge, color, background and reset', () => {
		const { root } = settingsPanel(settingsData({ nav: { pane: 'subtitleStyle', styleProp: null } }));

		expect(rowLabels(root)).toEqual(['Font', 'Text size', 'Edge style', 'Text color', 'Background', 'Reset to default']);
	});

	it('p11 a style property pane lists its choices and its header names the property', () => {
		const { root } = settingsPanel(settingsData({ nav: { pane: 'subtitleStyle', styleProp: 'edgeStyle' } }));

		expect(root.querySelector('.tvui-sidebar-header > span')?.textContent).toBe('Edge style');
		expect(rowLabels(root)).toEqual(['One', 'Two']);
	});

	it('p12 the header back button steps back', () => {
		let backs = 0;
		const { root } = settingsPanel(settingsData({ onBack: () => {
			backs++;
		} }));

		root.querySelector<HTMLElement>('.tvui-sidebar-header button')!.click();
		expect(backs).toBe(1);
	});
});
