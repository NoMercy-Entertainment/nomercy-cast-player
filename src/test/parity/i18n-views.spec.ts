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
	['views/search/SearchScreen.vue', 'Start typing to search.', 'views.search.start_typing', 'Start typing to search.'],
	['views/search/SearchScreen.vue', 'No results for "', 'views.search.no_results', 'No results for "{{query}}".'],
	['views/search/SearchKeyboard.vue', 'aria-label="Backspace"', 'views.search.backspace', 'Backspace'],
	['views/search/SearchKeyboard.vue', 'aria-label="Search videos"', 'views.search_videos', 'Search videos', 'Video\'s zoeken'],
	['views/splash/ReadyToCastScreen.vue', 'Connecting to your server…', 'views.splash.connecting_server', 'Connecting to your server…'],
	['views/splash/ReadyToCastScreen.vue', 'title="Connected"', 'views.splash.connected', 'Connected', 'Verbonden'],
	['views/splash/SenderRequiredScreen.vue', 'Your cast session expired', 'views.splash.expired', 'Your cast session expired. Open NoMercy on your phone or desktop and tap the'],
];

checkRows('views', rows);
