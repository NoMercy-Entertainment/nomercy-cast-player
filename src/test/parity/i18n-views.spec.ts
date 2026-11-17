// @vitest-environment jsdom
import { checkRows } from './i18nRows';
import type { I18nRow } from './i18nRows';

const rows: I18nRow[] = [
	['views/profile/ProfileScreen.vue', 'Current server', 'views.profile.current_server', 'Current server', 'Huidige server'],
	['views/profile/ProfileScreen.vue', 'Sign out of {{', 'views.profile.sign_out_confirm', 'Sign out of {{name}}?'],
	['views/profile/ProfileScreen.vue', '?? \'User\'', 'views.profile.user', 'User'],
	['views/profile/ProfileScreen.vue', '>Switch<', 'views.profile.switch', 'Switch', 'Wijzigen'],
	['views/profile/AboutScreen.vue', 'Your media, on every screen', 'views.profile.tagline', 'Your media, on every screen. Self-hosted. No ads, no tracking, no compromise.'],
	['views/profile/AboutScreen.vue', 'All product names, logos', 'views.profile.copyright', '© {{from}}–{{to}} NoMercy Entertainment. All product names, logos, and brands are property of their respective owners.'],
	['views/profile/AboutScreen.vue', 'Developed by NoMercy', 'about.developed_by', 'Developed by NoMercy Entertainment', 'Ontwikkeld door NoMercy Entertainment'],
	['views/profile/ServerInfoScreen.vue', 'Switch servers from', 'views.profile.switch_servers_hint', 'Switch servers from the NoMercy app on your phone or browser.'],
	['views/profile/ServerInfoScreen.vue', '<dt>Architecture</dt>', 'dashboard.system_info.architecture', 'Architecture', 'Architectuur'],
	['views/profile/ServerInfoScreen.vue', 'Couldn\'t load server info', 'views.profile.server_info_error', 'Couldn\'t load server info'],
	['views/profile/SettingsPanes.vue', 'label: \'Privacy\'', 'views.profile.category_privacy', 'Privacy'],
	['views/profile/AppSettingsScreen.vue', 'Use auto theme col', 'views.profile.auto_theme', 'Use auto theme colors'],
	['views/profile/AppSettingsScreen.vue', 'Nothing leaves this device', 'views.profile.diag_send_now_hint', 'Nothing leaves this device until you choose this'],
	['views/profile/AppSettingsScreen.vue', '\'Sending…\'', 'views.profile.diag_sending', 'Sending…'],
	['views/search/SearchKeyboard.vue', 'aria-label="Backspace"', 'views.search.backspace', 'Backspace'],
	['views/search/SearchKeyboard.vue', 'aria-label="Search videos"', 'views.search_videos', 'Search videos', 'Video\'s zoeken'],
	['views/splash/ReadyToCastScreen.vue', 'Connecting to your server…', 'views.splash.connecting_server', 'Connecting to your server…'],
	['views/splash/ReadyToCastScreen.vue', 'title="Connected"', 'views.splash.connected', 'Connected', 'Verbonden'],
	['views/splash/SenderRequiredScreen.vue', 'Your cast session expired', 'views.splash.expired', 'Your cast session expired. Open NoMercy on your phone or desktop and tap the'],
];

checkRows('views', rows);

// Part 2: the rest of views (HeroRailsView ... SeasonPickerOverlay).
const rest: I18nRow[] = [
	['views/HeroRailsView.vue', 'label: \'Refresh\'', 'common.refresh', 'Refresh', 'Vernieuwen'],
	['views/HeroRailsView.vue', 'Refreshing…', 'views.refreshing', 'Refreshing…'],
	['views/ServerDrivenView.vue', 'Nothing here yet.', 'views.empty_default', 'Nothing here yet.'],
	['views/ServerDrivenView.vue', 'label: \'Refresh\'', 'common.refresh', 'Refresh'],
	['views/home/HomeScreen.vue', 'Couldn\'t load home', 'views.home.load_error', 'Couldn\'t load home'],
	['views/home/HomeScreen.vue', 'Your home is empty', 'views.home.empty', 'Your home is empty. Add a library on your phone or desktop to get started.'],
	['views/libraries/LibrariesScreen.vue', 'Couldn\'t load libraries', 'views.libraries.load_error', 'Couldn\'t load libraries'],
	['views/libraries/LibrariesScreen.vue', 'No libraries yet', 'views.libraries.empty', 'No libraries yet. Add one from your phone or desktop.'],
	['views/library/LibraryScreen.vue', 'Couldn\'t load this library', 'views.library.load_error', 'Couldn\'t load this library'],
	['views/library/LibraryScreen.vue', 'This library is empty.', 'views.library.empty', 'This library is empty.'],
	['views/watch/WatchScreen.vue', 'Couldn\'t load video', 'views.watch.load_error', 'Couldn\'t load video'],
	['views/watch/WatchScreen.vue', 'Couldn\'t play video', 'views.watch.play_error', 'Couldn\'t play video'],
	['views/watch/WatchScreen.vue', 'Nothing to play', 'views.watch.nothing_to_play', 'Nothing to play'],
	['views/music/MusicStartScreen.vue', 'Couldn\'t load music', 'views.music.start_error_load', 'Couldn\'t load music'],
	['views/music/MusicStartScreen.vue', 'No music yet', 'views.music.start_empty', 'No music yet. Add a music library to get started.'],
	['views/music/MusicCardsScreen.vue', 'Couldn\'t load music cards', 'views.music.cards_error', 'Couldn\'t load music cards'],
	['views/music/MusicCardsScreen.vue', 'Nothing here.', 'views.music.cards_empty', 'Nothing here.'],
	['views/music/MusicListScreen.vue', 'return \'Pause\'', 'common.pause', 'Pause', 'Pauzeren'],
	['views/music/MusicListScreen.vue', 'return \'Play\'', 'common.play', 'Play', 'Afspelen'],
	['views/music/MusicListScreen.vue', 'Music is not connected', 'views.music.start_error_offline', 'Could not start playback. Music is not connected.'],
	['views/music/MusicListScreen.vue', '= \'Could not start playback.\'', 'views.music.start_error', 'Could not start playback.'],
	['views/music/MusicListScreen.vue', 'Couldn\'t load this list', 'views.music.list_error', 'Couldn\'t load this list'],
	['views/music/MusicListScreen.vue', '?? \'Album\'', 'components.music_card_type.album', 'Album', 'Album'],
	['views/music/MusicListScreen.vue', 'aria-label="Back"', 'common.back', 'Back', 'Terug'],
	['views/music/MusicListScreen.vue', 'aria-label="Like"', 'views.music.like', 'Like'],
	['views/music/MusicListScreen.vue', 'aria-label="About"', 'nav.about', 'About', 'Over'],
	['views/music/MusicListScreen.vue', '<span>Title</span>', 'common.title', 'Title', 'Titel'],
	['views/music/MusicAboutDialog.vue', '|| \'About\'', 'nav.about', 'About'],
	['views/now-playing/NowPlayingScreen.vue', 'aria-label="Close"', 'common.close', 'Close', 'Sluiten'],
	['views/now-playing/NowPlayingScreen.vue', 'aria-label="Like"', 'views.music.like', 'Like'],
	['views/now-playing/NowPlayingScreen.vue', 'aria-label="Lyrics"', 'music.player.lyrics', 'Lyrics', 'Songteksten'],
	['views/info/InfoScreen.vue', 'Couldn\'t load details', 'views.info.load_error', 'Couldn\'t load details'],
	['views/info/InfoScreen.vue', '\'Remove from watchlist\'', 'components.buttons.remove_from_watchlist', 'Remove from watchlist', 'Van kijklijst verwijderen'],
	['views/info/InfoScreen.vue', '\'Add to watchlist\'', 'components.buttons.add_to_watchlist', 'Add to watchlist', 'Aan kijklijst toevoegen'],
	['views/info/InfoScreen.vue', ' min`', 'views.info.minutes', '{{count}} min'],
	['views/info/InfoScreen.vue', '>Watch trailer<', 'info.watch_trailer', 'Watch trailer', 'Trailer bekijken'],
	['views/info/SeasonPickerOverlay.vue', 'aria-label="Season"', 'views.info.season', 'Season'],
];

checkRows('views part 2', rest);
