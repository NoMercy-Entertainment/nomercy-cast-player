import { describe, expect, it } from 'vitest';
import type { PersonData } from '@/queries/usePersonQuery';
import router from '@/router';
import { buildPersonRows, personHeroBackdrop } from './personRows';

const labels = {
	knownFor: 'Known for',
	acting: 'Acting',
	production: 'Production',
	writing: 'Writing',
	directing: 'Director',
	crew: 'Crew',
	creator: 'Creator',
};

const credit = (id: number, extra: Record<string, unknown> = {}) => ({
	id,
	title: `Title ${id}`,
	link: `/movie/${id}`,
	media_type: 'movie',
	hasItem: true,
	...extra,
});

const person: PersonData = {
	id: '1',
	name: 'Example Person',
	biography: 'An example biography.',
	profile: '/profile.jpg',
	known_for: [credit(1, { backdrop: '/a.jpg', vote_count: 5, character: 'Lead' }), credit(2, { backdrop: '/b.jpg', vote_count: 9 }), credit(1)],
	combined_credits: {
		cast: [credit(3, { character: 'Cameo' }), credit(4, { hasItem: false })],
		crew: [
			credit(5, { job: 'Executive Producer' }),
			credit(6, { job: 'Screenplay Writer' }),
			credit(7, { job: 'Director' }),
			credit(8, { job: 'Gaffer' }),
			credit(9, { job: 'Creator' }),
		],
	},
};

describe('row 6: person page matches PersonScreen.kt and PersonComponentMapping.kt', () => {
	it('the route mounts a view, it no longer redirects home (router/index.ts)', () => {
		const route = router.getRoutes().find((r) => r.name === 'person');

		expect(route?.redirect).toBeUndefined();
		expect(route?.components?.default ?? route?.components).toBeDefined();
	});

	it('builds Known for, Acting, Production, Writing, Directing, Crew, Creator from owned credits', () => {
		const rows = buildPersonRows(person, labels);
		const titles = rows.map((r) => (r.props as { title: string }).title);

		expect(titles).toEqual(['Known for', 'Acting', 'Production', 'Writing', 'Director', 'Crew', 'Creator']);
	});

	it('drops a credit the user does not own and a repeated card id', () => {
		const rows = buildPersonRows(person, labels);
		const ids = (row: number) => (rows[row]?.props as { items: Array<{ id: string }> }).items.map((i) => i.id);

		expect(ids(0)).toEqual(['1', '2']);
		expect(ids(1)).toEqual(['3']);
	});

	it('the card caption is the character, or the job for crew', () => {
		const rows = buildPersonRows(person, labels);
		const sub = (row: number) => ((rows[row]?.props as { items: Array<{ props: { data: { subtitle?: string } } }> }).items[0]!.props.data.subtitle);

		expect(sub(0)).toBe('Lead');
		expect(sub(1)).toBe('Cameo');
		expect(sub(2)).toBe('Executive Producer');
	});

	it('an empty group draws no row', () => {
		const rows = buildPersonRows({ id: '2', name: 'Other', known_for: [], combined_credits: { cast: [], crew: [] } }, labels);

		expect(rows).toEqual([]);
	});

	it('the hero backdrop is the known-for title with a backdrop and the most votes', () => {
		expect(personHeroBackdrop(person)?.id).toBe(2);
	});
});
