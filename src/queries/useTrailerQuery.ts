import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { Ref } from 'vue';
import { findTrailer, trailerCandidates } from '@/lib/trailers';
import type { TrailerLookup } from '@/lib/trailers';
import type { InfoVideo } from '@/queries/useInfoQuery';
import { QueryKeys } from '@/queries/keys';
import { authStore } from '@/stores/authStore';

// The KMP TV screen polls a trailer that is still processing every ten
// seconds, for up to five minutes. Same cadence here.
const POLL_INTERVAL_MS = 10_000;
const MAX_POLLS = 30;

export function useTrailerQuery(videos: Ref<InfoVideo[] | undefined>) {
	const candidates = computed(() => trailerCandidates(videos.value));
	const enabled = computed(() => Boolean(authStore.accessToken.value) && candidates.value.length > 0);

	return useQuery({
		queryKey: computed(() => QueryKeys.trailer(candidates.value)),
		queryFn: (): Promise<TrailerLookup> => findTrailer(candidates.value, authStore.accessToken.value ?? ''),
		enabled,
		// A signed URL expires, so a cached answer is not reused across visits.
		staleTime: 0,
		gcTime: 0,
		refetchOnWindowFocus: false,
		refetchInterval: (query) => {
			if (query.state.data?.state !== 'processing')
				return false;
			return query.state.dataUpdateCount < MAX_POLLS ? POLL_INTERVAL_MS : false;
		},
	});
}
