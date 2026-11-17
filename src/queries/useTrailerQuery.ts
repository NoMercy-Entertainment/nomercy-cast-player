import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { catalogTrailerIds, findTrailer, trailerCandidates } from '@/lib/trailers';
import type { TrailerLookup } from '@/lib/trailers';
import type { InfoVideo } from '@/queries/useInfoQuery';
import { QueryKeys } from '@/queries/keys';
import { authStore } from '@/stores/authStore';

// The KMP TV screen polls a trailer that is still processing every ten
// seconds, for up to five minutes. Same cadence here.
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 30;

// InfoScreen.kt:126-132: the catalog first, the info videos only when it is empty.
export function useTrailerQuery(type: Ref<string>, id: Ref<string>, videos: Ref<InfoVideo[] | undefined>) {
	const fallback = computed(() => trailerCandidates(videos.value));
	const enabled = computed(() => Boolean(authStore.accessToken.value));

	return useQuery({
		queryKey: computed(() => QueryKeys.trailer([type.value, id.value, ...fallback.value])),
		queryFn: async (): Promise<TrailerLookup> => {
			const token = authStore.accessToken.value ?? '';
			const catalog = await catalogTrailerIds(type.value, id.value, token);
			const candidates = catalog.length > 0
				? catalog
				: fallback.value;

			return candidates.length > 0
				? findTrailer(candidates, token)
				: { state: 'unavailable' };
		},
		enabled,
		// A signed URL expires, so a cached answer is not reused across visits.
		staleTime: 0,
		gcTime: 0,
		refetchOnWindowFocus: false,
		refetchInterval: (query) => {
			if (query.state.data?.state !== 'processing')
				return false;

			return query.state.dataUpdateCount < MAX_POLLS
				? POLL_INTERVAL_MS
				: false;
		},
	});
}
