import { describe, expect, it } from 'vitest';
import { backAction, settingsStepBack } from './state';
import type { BackState } from './state';
import { errorHintKey, errorMessageKey, mediaAbsentClaims } from './errors';
import { episodeLabel, titleAndSubtitle } from './title';

const idle: BackState = {
	search: false,
	settings: false,
	episodeOrLanguage: false,
	seekMode: false,
	controlsVisible: false,
	preScreen: false,
	remote: false,
};

describe('backAction (TvUiPlugin.kt:298-346)', () => {
	it('K12a closes the subtitle search first', () => {
		expect(backAction({ ...idle, search: true, settings: true })).toBe('closeSearch');
	});
	it('K12b steps the settings panel back one level', () => {
		expect(backAction({ ...idle, settings: true })).toBe('settingsStepBack');
	});
	it('K12c closes the episode and language dialogs and shows the pre-screen', () => {
		expect(backAction({ ...idle, episodeOrLanguage: true })).toBe('closeDialogToPreScreen');
	});
	it('K12d leaves seek mode', () => {
		expect(backAction({ ...idle, seekMode: true, controlsVisible: true })).toBe('cancelSeek');
	});
	it('K12e hides the controls', () => {
		expect(backAction({ ...idle, controlsVisible: true })).toBe('hideControls');
	});
	it('K12f local playback pauses and shows the pre-screen', () => {
		expect(backAction(idle)).toBe('pauseToPreScreen');
	});
	it('K12f remote playback pauses and leaves the screen', () => {
		expect(backAction({ ...idle, remote: true })).toBe('pauseAndExit');
	});
	it('K12g the pre-screen leaves the screen', () => {
		expect(backAction({ ...idle, preScreen: true })).toBe('exit');
	});
});

describe('settingsStepBack (TvUiPlugin.kt:227-234, PlayerSettingsScreen.kt:56-63)', () => {
	it('P02 a style property goes back to the property list', () => {
		expect(settingsStepBack({ pane: 'subtitleStyle', styleProp: 'fontSize' })).toEqual({ pane: 'subtitleStyle', styleProp: null });
	});
	it('P02 the main pane closes the panel', () => {
		expect(settingsStepBack({ pane: 'main', styleProp: null })).toBe('close');
	});
	it('P02 any other pane goes back to main', () => {
		expect(settingsStepBack({ pane: 'audio', styleProp: null })).toEqual({ pane: 'main', styleProp: null });
		expect(settingsStepBack({ pane: 'subtitleStyle', styleProp: null })).toEqual({ pane: 'main', styleProp: null });
	});
});

describe('errors (ErrorOverlay.kt, MediaAbsentPrompt.kt)', () => {
	it('claims only the media-absent code', () => {
		expect(mediaAbsentClaims('media_absent')).toBe(true);
		expect(mediaAbsentClaims('network timeout')).toBe(false);
		expect(mediaAbsentClaims(null)).toBe(false);
	});
	it.each([
		['codec failure', 'player_error_file'],
		['Network timeout', 'player_error_network'],
		['unsupported format', 'player_error_file'],
		['drm license', 'player_error_protected'],
		['transcode failed', 'player_error_transcode'],
		['live stall', 'player_error_live'],
		['boom', 'player_error_technical'],
		[null, 'error_unknown'],
	])('maps %s to %s', (error, key) => {
		expect(errorMessageKey(error)).toBe(key);
	});
	it('gives a hint for codec and network failures only', () => {
		expect(errorHintKey('codec')).toBe('player_error_hint_codec');
		expect(errorHintKey('network')).toBe('player_error_hint_network');
		expect(errorHintKey('boom')).toBeNull();
	});
});

describe('title and episode labels (TVTopBar.kt, PreScreenDialog.kt)', () => {
	const t = (key: string, vars?: Record<string, unknown>): string => `${key}${vars ? JSON.stringify(vars) : ''}`;
	it('a movie shows its title and no second line', () => {
		expect(titleAndSubtitle({ title: 'A Film' }, t)).toEqual({ title: 'A Film', subtitle: '' });
	});
	it('an episode shows the show, then S and E with the title', () => {
		expect(titleAndSubtitle({ show: 'A Show', title: 'Pilot', season: 1, episode: 2 }, t).subtitle)
			.toBe('player_s{"a":1}player_e{"a":2} • Pilot');
	});
	it('season zero is Extras', () => {
		expect(episodeLabel({ season: 0, episode: 3 }, t)).toBe('player_extras player_e{"a":3}');
	});
	it('a missing item reads Loading', () => {
		expect(titleAndSubtitle(undefined, t).title).toBe('player_loading');
	});
});
