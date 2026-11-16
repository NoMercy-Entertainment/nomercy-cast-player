// @vitest-environment jsdom
import { checkRows } from './i18nRows';
import type { I18nRow } from './i18nRows';

const rows: I18nRow[] = [
	['players/music/Lyrics.vue', 'Lyrics coming soon.', 'music.player.lyrics_coming_soon', 'Lyrics coming soon.'],
	['players/music/QueuePeek.vue', '<h3>Up next</h3>', 'music.player.up_next', 'Up next'],
	['players/music/ProgressControls.vue', 'aria-label="Shuffle"', 'music.player.shuffle', 'Shuffle', 'Shuffle'],
	['players/music/ProgressControls.vue', 'aria-label="Previous track"', 'music.player.previous_track', 'Previous track'],
	['players/music/ProgressControls.vue', 'playing ? \'Pause\'', 'common.pause', 'Pause', 'Pauzeren'],
	['players/music/ProgressControls.vue', 'aria-label="Next track"', 'music.player.next_track', 'Next track'],
	['players/music/ProgressControls.vue', '`Repeat ', 'music.player.repeat_off', 'Repeat off'],
	['players/music/transport.ts', 'return \'Live\'', 'music.player.live', 'Live', 'Live'],
	['players/video/VideoPlayer.vue', 'The video player could not start.', 'player.start_error', 'The video player could not start.'],
	['players/video/TVOverlayPlugin.ts', '\'Skip credits\'', 'player.skip_credits', 'Skip credits'],
	['players/video/TVOverlayPlugin.ts', '\'Skip intro\'', 'player.skip_intro', 'Skip intro'],
	['players/video/TVOverlayPlugin.ts', '\'Next episode\'', 'player.next_episode', 'Next episode', 'Volgende aflevering'],
	['players/video/TVOverlayPlugin.ts', '?? \'Now playing\'', 'music.player.now_playing', 'Now playing', 'Wordt nu afgespeeld'],
	['players/video/pluginPanels/PreScreen.ts', '\'Pre-play menu\'', 'player.pre_screen_aria', 'Pre-play menu'],
	['players/video/pluginPanels/PreScreen.ts', 'Resume from', 'player.resume_from', 'Resume from {{time}}'],
	['players/video/pluginPanels/PreScreen.ts', ': \'Play\'', 'common.play', 'Play', 'Afspelen'],
	['players/video/pluginPanels/PreScreen.ts', 'makeButton(\'Restart\'', 'player.restart', 'Restart', 'Herstarten'],
	['players/video/pluginPanels/PreScreen.ts', 'makeButton(\'Episodes\'', 'cast_remote.episodes', 'Episodes', 'Afleveringen'],
	['players/video/pluginPanels/PreScreen.ts', '\'Audio and subtitles\'', 'player.audio_and_subtitles', 'Audio and subtitles', 'Audio en ondertiteling'],
	['players/video/pluginPanels/LanguageScreen.ts', '\'Audio and subtitles\'', 'player.audio_and_subtitles', 'Audio and subtitles'],
	['players/video/pluginPanels/LanguageScreen.ts', '\'Quality\'', 'cast_remote.quality', 'Quality', 'Kwaliteit'],
	['players/video/pluginPanels/LanguageScreen.ts', '`Auto (', 'player.quality_auto_with', 'Auto ({{label}})'],
	['players/video/pluginPanels/LanguageScreen.ts', ': \'Auto\'', 'cast_remote.quality_auto', 'Auto', 'Automatisch'],
	['players/video/pluginPanels/LanguageScreen.ts', '\'Audio\',', 'cast_remote.audio', 'Audio', 'Audio'],
	['players/video/pluginPanels/LanguageScreen.ts', '\'Subtitles\',', 'cast_remote.subtitles', 'Subtitles', 'Ondertiteling'],
	['players/video/pluginPanels/LanguageScreen.ts', 'label: \'Off\'', 'cast_remote.off', 'Off', 'Uit'],
	['players/video/pluginPanels/LanguageScreen.ts', '= \'Playback\'', 'preferences.display.section_playback', 'Playback', 'Afspelen'],
	['players/video/pluginPanels/LanguageScreen.ts', '\'Auto-skip intros and outros\'', 'player.auto_skip_chapters', 'Auto-skip intros and outros', 'Intro\'s en outro\'s automatisch overslaan'],
	['players/video/pluginPanels/EpisodeScreen.ts', '\'aria-label\', \'Episodes\'', 'cast_remote.episodes', 'Episodes'],
	['players/video/pluginPanels/EpisodeScreen.ts', 'return \'Collection\'', 'info.collection', 'Collection', 'Verzameling'],
	['players/video/pluginPanels/EpisodeScreen.ts', 'return \'Extras\'', 'player.extras', 'Extras', 'Extra\'s'],
	['players/video/pluginPanels/EpisodeScreen.ts', '`Season ', 'player.season_number', 'Season {{number}}'],
	['players/video/pluginPanels/EpisodeScreen.ts', '`Extras E', 'player.extras_episode', 'Extras E{{episode}}'],
];

checkRows('players', rows);
