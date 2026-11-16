import type { SettingsPane } from './state';

export const FONT_SIZE_CHOICES = [18, 20, 24, 28, 32, 36] as const;
export const BACKGROUND_CHOICES = [0, 0.25, 0.5, 0.75, 1] as const;
const ENTER_GUARD_MS = 300;

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
