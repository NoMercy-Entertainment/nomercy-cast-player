// @vitest-environment jsdom
import { checkRows } from './i18nRows';
import type { I18nRow } from './i18nRows';

const components: I18nRow[] = [
	['components/feedback/ErrorPanel.vue', '?? \'Something went wrong\'', 'common.something_went_wrong', 'Something went wrong', 'Er ging iets mis'],
	['components/feedback/ErrorPanel.vue', 'Try again', 'startup.tryAgain', 'Try again', 'Opnieuw proberen'],
	['components/feedback/LoadingIndicator.vue', 'aria-label="Loading"', 'common.loading', 'Loading', 'Laden'],
];

checkRows('components', components);

const layout: I18nRow[] = [
	['layout/TopNavBar.vue', 'label="Home"', 'nav.home', 'Home', 'Home'],
	['layout/TopNavBar.vue', 'label="Libraries"', 'nav.libraries', 'Libraries', 'Bibliotheken'],
	['layout/TopNavBar.vue', 'label="Music"', 'nav.music', 'Music', 'Muziek'],
	['layout/TopNavBar.vue', 'aria-label="Search"', 'nav.search', 'Search', 'Zoeken'],
	['layout/NowPlayingPill.vue', '\'Connecting…\'', 'cast_remote.connecting', 'Connecting…', 'Verbinden…'],
	['layout/NowPlayingPill.vue', '\'Reconnecting…\'', 'layout.connection.reconnecting', 'Reconnecting…', 'Opnieuw verbinden…'],
	['layout/NowPlayingPill.vue', '\'Connected\'', 'activity.connection.connected', 'Connected', 'Verbonden'],
	['layout/NowPlayingPill.vue', '\'Disconnected\'', 'activity.connection.disconnected', 'Disconnected', 'Verbinding verbroken'],
	['layout/ProfileChip.vue', '?? \'You\'', 'layout.profile_chip.you', 'You'],
	['layout/ProfileChip.vue', '`Profile: ', 'layout.profile_chip.aria', 'Profile: {{name}}'],
	['layout/TvMiniPlayer.vue', '`Now playing: ', 'layout.mini_player.aria', 'Now playing: {{title}}'],
	['App.vue', 'title="Could not start the cast"', 'app.boot_error_title', 'Could not start the cast'],
	['App.vue', 'title="Cast again to keep watching"', 'app.cast_again_title', 'Cast again to keep watching'],
	['App.vue', 'Your sign-in on this TV is ending', 'app.cast_again_message', 'Your sign-in on this TV is ending. Cast again from your phone to keep watching.'],
];

checkRows('layout', layout);
