import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { unwrapComponents } from './unwrapComponents';
import type { ComponentPayload } from './unwrapComponents';
import { apiFetch } from '@/lib/http/client';
import type { PaletteColors } from '@/lib/images/urls';
import type { Component } from '@/server-components/types';

/** PersonResponse.kt CreditItem and KnownFor, the fields the TV page reads. */
export interface PersonCredit {
	id: number;
	title?: string | null;
	name?: string | null;
	overview?: string | null;
	link?: string | null;
	year?: number | null;
	media_type?: string | null;
	backdrop?: string | null;
	poster?: string | null;
	character?: string | null;
	job?: string | null;
	vote_count?: number | null;
	hasItem?: boolean | null;
	have_items?: number | null;
	number_of_items?: number | null;
	color_palette?: { backdrop?: PaletteColors; poster?: PaletteColors };
}

/** PersonResponse.kt: an older server answers this object itself. */
export interface PersonData {
	id: string;
	name: string;
	biography?: string;
	profile?: string | null;
	link?: string | null;
	known_for?: PersonCredit[];
	combined_credits?: { cast?: PersonCredit[]; crew?: PersonCredit[] };
}

/** Components from a server that honors version=lolomo, the plain person object from an older one. */
export type PersonPage =
	| { kind: 'components'; components: Component[] } |
	{ kind: 'legacy'; person: PersonData };

type PersonPayload = ComponentPayload | PersonData | { data: PersonData };

// Servers older than media-server dev f1ce58a7b ignore version and answer the person DTO.
async function fetchPerson(id: string): Promise<PersonPage> {
	const response = await apiFetch<PersonPayload>({
		path: `/api/v1/person/${id}?version=lolomo`,
		method: 'GET',
	});
	const components = unwrapComponents(response as ComponentPayload);

	if (components.length > 0)
		return { kind: 'components', components };

	const body = response as { data?: Partial<PersonData> } | null;
	const candidate = (body && 'data' in body && body.data
		? body.data
		: response) as Partial<PersonData> | null;

	if (candidate && !Array.isArray(candidate) && typeof candidate.name === 'string')
		return { kind: 'legacy', person: candidate as PersonData };

	return { kind: 'components', components: [] };
}

export function usePersonQuery(id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.person(id.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchPerson(id.value),
		...queryConfigs.standard,
	});
}
