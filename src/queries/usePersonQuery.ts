import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';
import { apiFetch } from '@/lib/http/client';
import type { PaletteColors } from '@/lib/images/urls';

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

/** PersonResponse.kt: GET person/{id} answers this object itself. */
export interface PersonData {
	id: string;
	name: string;
	biography?: string;
	profile?: string | null;
	link?: string | null;
	known_for?: PersonCredit[];
	combined_credits?: { cast?: PersonCredit[]; crew?: PersonCredit[] };
}

async function fetchPerson(id: string): Promise<PersonData> {
	const response = await apiFetch<PersonData | { data: PersonData }>({
		path: `/api/v1/person/${id}`,
		method: 'GET',
	});

	return 'data' in response && response.data
		? response.data
		: response as PersonData;
}

export function usePersonQuery(id: Ref<string>) {
	const queryKey = computed(() => [...QueryKeys.person(id.value)]);

	return useQuery({
		queryKey,
		queryFn: () => fetchPerson(id.value),
		...queryConfigs.standard,
	});
}
