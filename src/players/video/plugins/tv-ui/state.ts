export interface BackState {
	search: boolean;
	settings: boolean;
	episodeOrLanguage: boolean;
	seekMode: boolean;
	controlsVisible: boolean;
	preScreen: boolean;
	remote: boolean;
}

export type BackAction = 'closeSearch' | 'settingsStepBack' | 'closeDialogToPreScreen' | 'cancelSeek' | 'hideControls' | 'pauseToPreScreen' | 'pauseAndExit' | 'exit';

// TvUiPlugin.kt:298-346 (handleBackDelegate): the one BACK path, checked in this order.
export function backAction(state: BackState): BackAction {
	if (state.search)
		return 'closeSearch';
	if (state.settings)
		return 'settingsStepBack';
	if (state.episodeOrLanguage)
		return 'closeDialogToPreScreen';
	if (state.seekMode)
		return 'cancelSeek';
	if (state.controlsVisible)
		return 'hideControls';
	if (state.preScreen)
		return 'exit';
	return state.remote ? 'pauseAndExit' : 'pauseToPreScreen';
}

export type SettingsPane = 'main' | 'quality' | 'subtitle' | 'audio' | 'subtitleStyle';
export type StyleProp = 'fontFamily' | 'fontSize' | 'edgeStyle' | 'textColor' | 'background';

export interface SettingsNav {
	pane: SettingsPane;
	styleProp: StyleProp | null;
}

// TvUiPlugin.kt:227-234.
export function settingsStepBack(nav: SettingsNav): SettingsNav | 'close' {
	if (nav.pane === 'subtitleStyle' && nav.styleProp !== null)
		return { pane: 'subtitleStyle', styleProp: null };
	if (nav.pane === 'main')
		return 'close';
	return { pane: 'main', styleProp: null };
}
