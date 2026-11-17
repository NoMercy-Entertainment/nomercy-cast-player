import { describe, expect, it } from 'vitest';

import { buildInfoRows } from './infoRows';
import type { InfoData } from '@/queries/useInfoQuery';
import type { NMCardWrapper, NMCarouselWrapper } from '@/server-components/types';

// InfoComponentMapping.kt:34-107 buildInfoCarouselRows: collection, writer and director, cast, crew.
const labels = {
	collections: 'Collections',
	writerDirector: 'Writer & Director',
	cast: 'Cast',
	crew: 'Crew',
};

function person(id: number, name: string, extra: Record<string, unknown> = {}) {
	return { id, name, link: `/person/${id}`, profile: `/p${id}.jpg`, ...extra };
}

function rows(info: InfoData) {
	return buildInfoRows(info, labels).map((row) => ({
		id: row.id,
		title: (row.props as NMCarouselWrapper).title,
		cards: ((row.props as NMCarouselWrapper).items).map((item) => (item.props as { data: NMCardWrapper }).data),
	}));
}

describe('the info page rows follow the native InfoComponentMapping', () => {
	it('lists the rows in the native order with the native titles', () => {
		const info = {
			collection: [{ id: 1, title: 'Part 1', link: '/movie/1', media_type: 'movie', poster: '/a.jpg' }],
			writer: person(10, 'Writer One', { job: 'Writer' }),
			director: person(11, 'Director One', { job: 'Director' }),
			cast: [person(20, 'Actor One', { character: 'Hero' })],
			crew: [person(30, 'Crew One', { job: 'Editor' })],
		} as unknown as InfoData;

		expect(rows(info).map((row) => [row.id, row.title])).toEqual([
			['info-collection', 'Collections'],
			['info-director-writer', 'Writer & Director'],
			['info-cast', 'Cast'],
			['info-crew', 'Crew'],
		]);
	});

	it('skips a row that has no card and leaves out a person without a link', () => {
		const info = {
			cast: [person(20, 'Linked'), { id: 21, name: 'No link', link: '' }],
			crew: [],
		} as unknown as InfoData;

		expect(rows(info).map((row) => row.id)).toEqual(['info-cast']);
		expect(rows(info)[0]!.cards.map((card) => card.title)).toEqual(['Linked']);
	});

	it('draws writer then director as person cards that carry their job', () => {
		const info = {
			writer: person(10, 'Writer One', { job: 'Writer' }),
			director: person(11, 'Director One', { job: 'Director' }),
		} as unknown as InfoData;

		const [row] = rows(info);

		expect(row!.cards.map((card) => [card.title, card.subtitle, card.type, card.poster, card.link])).toEqual([
			['Writer One', 'Writer', 'person', '/p10.jpg', '/person/10'],
			['Director One', 'Director', 'person', '/p11.jpg', '/person/11'],
		]);
	});

	it('sorts cast by credit order then name, people with a picture first, one card per name and id', () => {
		const info = {
			cast: [
				person(1, 'Zed', { character: 'C', order: '2' }),
				person(2, 'Amy', { character: 'A', order: '2' }),
				person(3, 'No picture', { profile: null, order: '0' }),
				person(4, 'Bob', { character: 'B', order: '1' }),
				person(1, 'Zed', { character: 'Other', order: '2' }),
			],
		} as unknown as InfoData;

		const [row] = rows(info);

		expect(row!.cards.map((card) => card.title)).toEqual(['Bob', 'Amy', 'Zed', 'No picture']);
		expect(row!.cards.find((card) => card.title === 'Bob')!.subtitle).toBe('B');
	});

	it('shows crew with their job as the caption', () => {
		const info = { crew: [person(30, 'Crew One', { job: 'Editor' })] } as unknown as InfoData;

		expect(rows(info)[0]!.cards[0]!.subtitle).toBe('Editor');
	});

	it('maps collection members to title cards that keep the id, link and artwork', () => {
		const info = {
			collection: [
				{ id: 5, title: 'Part 5', link: '/movie/5', media_type: 'movie', poster: '/p.jpg', backdrop: '/b.jpg', year: 2001 },
				{ id: 5, title: 'Part 5 again', link: '/movie/5', media_type: 'movie' },
				{ id: 6, title: 'No link', link: '', media_type: 'movie' },
			],
		} as unknown as InfoData;

		const [row] = rows(info);

		expect(row!.cards).toHaveLength(1);
		expect(row!.cards[0]).toMatchObject({ id: '5', title: 'Part 5', link: '/movie/5', type: 'movie', poster: '/p.jpg', backdrop: '/b.jpg', year: 2001 });
	});

	it('returns no rows for a title with no people and no collection', () => {
		expect(buildInfoRows({} as InfoData, labels)).toEqual([]);
	});
});
