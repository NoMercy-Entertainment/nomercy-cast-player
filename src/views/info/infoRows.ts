import type { InfoData, InfoPerson, InfoRelated } from '@/queries/useInfoQuery';
import type { Component, NMCardWrapper } from '@/server-components/types';

/*
 * InfoComponentMapping.kt:34-107 buildInfoCarouselRows, minus the seasons row
 * (InfoSeasons draws that one with its season chip): collection, writer and
 * director, cast, crew. Row titles arrive resolved, as on native.
 */
export interface InfoRowLabels {
	collections: string;
	writerDirector: string;
	cast: string;
	crew: string;
}

function card(data: NMCardWrapper): Component {
	return {
		id: data.id,
		component: 'NMCard',
		props: {
			id: data.id,
			title: data.title,
			data,
		},
	} as const satisfies Component;
}

function carousel(id: string, title: string, items: Component[]): Component {
	return {
		id,
		component: 'NMCarousel',
		props: {
			id,
			title,
			items,
		},
	} as const satisfies Component;
}

function distinctById(items: NMCardWrapper[]): NMCardWrapper[] {
	const seen = new Set<string>();

	return items.filter((item) => {
		if (seen.has(item.id))
			return false;

		seen.add(item.id);

		return true;
	});
}

function personCard(person: InfoPerson, subtitle: string | null | undefined): NMCardWrapper | null {
	if (!person.link)
		return null;

	return {
		id: String(person.id),
		title: person.name,
		overview: person.character ?? person.job ?? undefined,
		link: person.link,
		type: 'person',
		poster: person.profile ?? undefined,
		color_palette: person.color_palette,
		subtitle: subtitle ?? undefined,
	};
}

function relatedCard(item: InfoRelated): NMCardWrapper | null {
	if (!item.link)
		return null;

	return {
		id: String(item.id),
		title: item.title ?? '',
		overview: item.overview ?? undefined,
		link: item.link,
		year: item.year ?? undefined,
		type: item.media_type,
		backdrop: item.backdrop ?? undefined,
		poster: item.poster ?? undefined,
		logo: item.logo ?? undefined,
		color_palette: item.color_palette,
		have_items: item.have_items ?? undefined,
		number_of_items: item.number_of_items ?? undefined,
	};
}

// ArrayHelpers.kt sortByFilteredAlphabetized: one credit per name, people with a picture first, by credit order then name.
function sortedCredits(people: InfoPerson[]): InfoPerson[] {
	const byName = new Map<string, InfoPerson>();

	for (const person of people) {
		if (!byName.has(person.name)) {
			byName.set(person.name, person);
		}
	}

	const order = (person: InfoPerson): number => {
		const parsed = Number.parseInt(person.order ?? '', 10);

		return Number.isNaN(parsed)
			? Number.MAX_SAFE_INTEGER
			: parsed;
	};

	const compare = (a: InfoPerson, b: InfoPerson): number =>
		order(a) - order(b) || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
	const credits = [...byName.values()];

	return [
		...credits.filter((person) => person.profile).sort(compare),
		...credits.filter((person) => !person.profile).sort(compare),
	];
}

function row(id: string, title: string, cards: Array<NMCardWrapper | null>): Component[] {
	const present = cards.filter((c): c is NMCardWrapper => c !== null);
	const unique = distinctById(present);

	return unique.length > 0
		? [carousel(id, title, unique.map(card))]
		: [];
}

type Caption = (person: InfoPerson) => string | null | undefined;

function creditCards(people: InfoPerson[], caption: Caption) {
	return sortedCredits(people).map((person) => personCard(person, caption(person)));
}

export function buildInfoRows(info: InfoData, labels: InfoRowLabels): Component[] {
	const collection = (info.collection ?? []).map(relatedCard);
	const leads = [info.writer, info.director].filter((p): p is InfoPerson => Boolean(p));
	const directorWriter = leads.map((person) => personCard(person, person.job ?? person.character));

	return [
		...row('info-collection', labels.collections, collection),
		...row('info-director-writer', labels.writerDirector, directorWriter),
		...row('info-cast', labels.cast, creditCards(info.cast ?? [], (p) => p.character)),
		...row('info-crew', labels.crew, creditCards(info.crew ?? [], (p) => p.job)),
	];
}
