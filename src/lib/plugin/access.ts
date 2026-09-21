/**
 * What the sender's account may see on this screen.
 *
 * The receiver has no session of its own: it draws for whoever cast to it, so
 * the answer is the one the server gave that account. A plugin the account has
 * no access to is not on the wall at all.
 */
const VISIBLE = new Set<string>(['owned', 'shared']);

export function canSee(access: string | null | undefined): boolean {
	return VISIBLE.has(access ?? 'shared');
}

export function visibleEntries<T extends { access?: string | null }>(entries: T[]): T[] {
	return entries.filter(entry => canSee(entry.access));
}
