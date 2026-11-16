import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { fetchSaasUser } from '@/lib/nomercyApi';
import { authStore } from '@/stores/authStore';

/**
 * SaaS /v1/me — the user's profile (name, email, avatarUrl, locale,
 * features). Cached for the cast session; refetched on auth changes.
 */
export function useMeQuery() {
	const enabled = computed(() => Boolean(authStore.accessToken.value));

	return useQuery({
		queryKey: ['me'],
		queryFn: () => fetchSaasUser(authStore.accessToken.value ?? ''),
		enabled,
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false,
	});
}
