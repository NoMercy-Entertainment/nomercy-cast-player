import { describe, expect, it } from 'vitest';
import { FONT_SIZE_CHOICES, mainRows, paneTitleKey, styleRowFocus, withinEnterGuard } from './settingsModel';

describe('settings model (PlayerSettingsScreen.kt)', () => {
	it('p03 rows without a choice are disabled', () => {
		const rows = mainRows({
			levels: 1,
			textTracks: 0,
			audioTracks: 1,
		});

		expect(rows.map((row) => [row.id, row.enabled])).toEqual([
			['audio', false],
			['subtitle', false],
			['subtitleStyle', true],
			['quality', false],
			['autoSkip', true],
			['restart', true],
		]);
	});

	it('p03 rows with a choice are enabled', () => {
		const rows = mainRows({
			levels: 3,
			textTracks: 2,
			audioTracks: 2,
		});

		expect(rows.every((row) => row.enabled)).toBe(true);
	});

	it('p04 the first enabled row takes the initial focus', () => {
		expect(mainRows({
			levels: 1,
			textTracks: 2,
			audioTracks: 1,
		}).findIndex((row) => row.enabled)).toBe(1);
	});

	it('p05 an action inside 300 ms of entering a pane is ignored', () => {
		expect(withinEnterGuard(1000, 1200)).toBe(true);
		expect(withinEnterGuard(1000, 1301)).toBe(false);
	});

	it('p06 each pane has its title key', () => {
		expect(paneTitleKey('main')).toBe('player_settings');
		expect(paneTitleKey('quality')).toBe('player_quality');
		expect(paneTitleKey('subtitle')).toBe('dialog_subtitle_tracks');
		expect(paneTitleKey('audio')).toBe('dialog_audio_tracks');
		expect(paneTitleKey('subtitleStyle')).toBe('subtitle_style');
	});

	it('p07 the font size choices are the KMP list', () => {
		expect(FONT_SIZE_CHOICES).toEqual([18, 20, 24, 28, 32, 36]);
	});

	it('p08 a choice row takes focus when current, else the first row when none matches', () => {
		expect(styleRowFocus([false, true, false])).toBe(1);
		expect(styleRowFocus([false, false, false])).toBe(0);
	});
});
