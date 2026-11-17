import type { SettingsPane } from './state';

export const FONT_SIZE_CHOICES = [18, 20, 24, 28, 32, 36] as const;
export const BACKGROUND_CHOICES = [0, 0.25, 0.5, 0.75, 1] as const;
const ENTER_GUARD_MS = 300;

// TextTrackStyle.kt:121-135 SubtitleFont; the stacks equal app-web subtitleStyles.ts fontFamilies.
export const FONT_CHOICES = [
	{ name: 'ReithSans', stack: 'ReithSans, sans-serif' },
	{ name: 'Arial', stack: 'Arial, sans-serif' },
	{ name: 'Courier New', stack: 'Courier New, monospace' },
	{ name: 'Georgia', stack: 'Georgia, serif' },
	{ name: 'Verdana', stack: 'Verdana, sans-serif' },
] as const satisfies ReadonlyArray<{ name: string; stack: string }>;

const SIDEBAR_WIDTH = 320;
const VIDEO_MARGIN = 24;
const VIDEO_MARGIN_RIGHT = 48;
export const SETTINGS_ANIM_MS = 400;

// WatchScreen.kt:508-560: scale and shift that fit the picture right of the sidebar.
export function videoShrink(width: number) {
	const available = width - SIDEBAR_WIDTH - VIDEO_MARGIN - VIDEO_MARGIN_RIGHT;
	const scale = Math.min(Math.max(available / width, 0.5), 1);
	const translateX = SIDEBAR_WIDTH + VIDEO_MARGIN + available / 2 - width / 2;

	return { scale, translateX, radius: 16 } as const satisfies Record<string, number>;
}

// The family before the comma names the font in both stored forms (SubtitleFont.fromStack).
export function fontName(stack: string): string {
	return (stack.split(',')[0] ?? '').trim();
}

export interface MainRow {
	id: 'audio' | 'subtitle' | 'subtitleStyle' | 'quality' | 'autoSkip' | 'restart';
	enabled: boolean;
}

// PlayerSettingsScreen.kt:mainRows: a row with nothing to choose is shown disabled.
export function mainRows(counts: {
	levels: number;
	textTracks: number;
	audioTracks: number;
}): MainRow[] {
	return [
		{ id: 'audio', enabled: counts.audioTracks > 1 },
		{ id: 'subtitle', enabled: counts.textTracks > 0 },
		{ id: 'subtitleStyle', enabled: true },
		{ id: 'quality', enabled: counts.levels > 1 },
		{ id: 'autoSkip', enabled: true },
		{ id: 'restart', enabled: true },
	];
}

export function withinEnterGuard(enteredAt: number, now: number): boolean {
	return now - enteredAt <= ENTER_GUARD_MS;
}

const PANE_TITLES = {
	main: 'player_settings',
	quality: 'player_quality',
	subtitle: 'dialog_subtitle_tracks',
	audio: 'dialog_audio_tracks',
	subtitleStyle: 'subtitle_style',
} as const satisfies Record<SettingsPane, string>;

export function paneTitleKey(pane: SettingsPane): string {
	return PANE_TITLES[pane];
}

// The current choice takes focus; with no match the first row does.
export function styleRowFocus(current: boolean[]): number {
	return Math.max(current.indexOf(true), 0);
}
