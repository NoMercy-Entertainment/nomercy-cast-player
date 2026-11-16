/** TvHomeAdapter.kt:551: the TV row's end card reads "Show All" over the title, without "Latest in ". */
export function showAllLabel(title?: string | null): string {
	return `Show All\n${(title ?? '').replace('Latest in ', '')}`;
}
