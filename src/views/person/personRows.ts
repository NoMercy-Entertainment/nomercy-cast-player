import type { PersonCredit, PersonData } from '@/queries/usePersonQuery';
import type { Component, NMCardWrapper } from '@/server-components/types';

/*
 * PersonScreen.kt:86-113 and PersonComponentMapping.kt:29-120: the person page rows,
 * built on the client. Only credits the user owns (hasItem) draw, empty rows drop.
 */
export interface PersonRowLabels {
	knownFor: string;
	acting: string;
	production: string;
	writing: string;
	directing: string;
	crew: string;
	creator: string;
}

function has(job: string | null | undefined, word: string): boolean {
	return (job ?? '').toLowerCase().includes(word.toLowerCase());
}

function card(data: NMCardWrapper): Component {
	return {
		id: data.id,
		component: 'NMCard',
		props: { id: data.id, title: data.title, data },
	} as const satisfies Component;
}

function distinctCards(credits: PersonCredit[], subtitle: (c: PersonCredit) => string | undefined): Component[] {
	const seen = new Set<string>();
	const out: Component[] = [];

	for (const c of credits) {
		const id = String(c.id);

		if (!c.link || seen.has(id))
			continue;

		seen.add(id);
		out.push(card({
			id,
			title: c.title ?? c.name ?? '',
			overview: c.overview ?? undefined,
			link: c.link,
			year: c.year ?? undefined,
			type: c.media_type ?? 'movie',
			backdrop: c.backdrop ?? undefined,
			poster: c.poster ?? undefined,
			color_palette: c.color_palette,
			have_items: c.have_items ?? undefined,
			number_of_items: c.number_of_items ?? undefined,
			subtitle: subtitle(c),
		}));
	}

	return out;
}

export function buildPersonRows(person: PersonData, labels: PersonRowLabels): Component[] {
	const cast = (person.combined_credits?.cast ?? []).filter((c) => c.hasItem === true);
	const crew = (person.combined_credits?.crew ?? []).filter((c) => c.hasItem === true);
	const groups: Array<[string, PersonCredit[]]> = [
		[labels.acting, cast],
		[labels.production, crew.filter((c) => has(c.job, 'Produc'))],
		[labels.writing, crew.filter((c) => has(c.job, 'Writ'))],
		[labels.directing, crew.filter((c) => has(c.job, 'Direct'))],
		[labels.crew, crew.filter((c) => !has(c.job, 'Produc') && !has(c.job, 'Writ') && !has(c.job, 'Direct') && !has(c.job, 'Creator'))],
		[labels.creator, crew.filter((c) => has(c.job, 'Creator'))],
	];
	const rows: Array<[string, string, Component[]]> = [
		['person-known-for', labels.knownFor, distinctCards(person.known_for ?? [], (c) => c.character ?? undefined)],
		...groups.map(([title, credits], index): [string, string, Component[]] => [
			`person-group-${index}`,
			title,
			distinctCards(credits, (c) => c.character ?? c.job ?? undefined),
		]),
	];

	return rows
		.filter(([, , items]) => items.length > 0)
		.map(([id, title, items]) => ({
			id,
			component: 'NMCarousel',
			props: { id, title, items },
		}) as const satisfies Component);
}

// PersonScreen.kt:59-78: the backdrop of the known-for title with the most votes.
export function personHeroBackdrop(person: PersonData): PersonCredit | null {
	return (person.known_for ?? [])
		.filter((k) => k.backdrop)
		.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))[0] ?? null;
}
