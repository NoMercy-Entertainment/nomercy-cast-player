import i18next from '@/i18n/i18next';

/** TvHomeAdapter.kt:551: the TV row's end card reads "Show All" over the title, without "Latest in ". */
export function showAllLabel(title?: string | null, lng?: string): string {
	return `${i18next.t('components.show_all', { lng })}\n${(title ?? '').replace('Latest in ', '')}`;
}
