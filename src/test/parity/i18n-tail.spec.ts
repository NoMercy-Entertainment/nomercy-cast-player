// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { checkRows } from './i18nRows';
import type { I18nRow } from './i18nRows';
import i18n from '@/i18n/i18next';
import { showAllLabel } from '@/server-components/showAllLabel';

const tail: I18nRow[] = [
	['server-components/NMGrid.vue', '|| \'More\'', 'music.more', 'More', 'Meer'],
	['server-components/NMHomeCard.vue', '\t\t\t\t\tWatch\n', 'components.cards.watch', 'Watch', 'Bekijken'],
	['server-components/NMHomeCard.vue', '\t\t\t\t\tDetails\n', 'common.details', 'Details'],
	['server-components/NMMusicCard.vue', 'return \'Playlist\'', 'components.music_card_type.playlist', 'Playlist', 'Afspeellijst'],
	['server-components/NMMusicCard.vue', 'return \'Album\'', 'components.music_card_type.album', 'Album', 'Album'],
	['server-components/NMMusicCard.vue', 'return \'Artist\'', 'components.music_card_type.artist', 'Artist', 'Artiest'],
	['server-components/NMMusicCard.vue', 'return \'Release\'', 'components.music_card_type.release', 'Release', 'Uitgave'],
	['server-components/NMMusicCard.vue', 'return \'Genre\'', 'components.music_card_type.genre', 'Genre', 'Genre'],
	['server-components/NMMusicCard.vue', '\'track\' : \'tracks\'', 'components.track_count_other', '{{count}} tracks', '{{count}} nummers'],
	['server-components/showAllLabel.ts', '`Show All', 'components.show_all', 'Show All', 'Alles weergeven'],
	['server-components/UnknownComponent.vue', 'Unknown: {{', 'views.unknown', 'Unknown', 'Onbekend'],
	['cast/receiver.ts', 'The account service did not answer.', 'cast.boot_step_account', 'The account service did not answer.'],
	['cast/receiver.ts', 'The media server does not answer.', 'cast.boot_step_server', 'The media server does not answer.'],
	['cast/receiver.ts', 'did not open.', 'cast.boot_step_connect', 'The connection to the media server did not open.'],
	['lib/diagnostics/sender.ts', '\'Not signed in\'', 'diagnostics.not_signed_in', 'Not signed in'],
];

checkRows('tail', tail);

it('tail: the Show All end card follows the language and keeps the title', () => {
	expect(showAllLabel('Latest in Movies')).toBe('Show All\nMovies');
	expect(showAllLabel('Latest in Movies', 'nl')).toBe('Alles weergeven\nMovies');
});

it('tail: the track count follows the plural form', () => {
	expect(i18n.t('components.track_count', { count: 1 })).toBe('1 track');
	expect(i18n.t('components.track_count', { count: 3, lng: 'nl' })).toBe('3 nummers');
});
