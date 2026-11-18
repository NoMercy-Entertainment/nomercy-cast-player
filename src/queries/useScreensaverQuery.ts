import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiFetch } from '@/lib/http/client';
import type { PaletteColors } from '@/lib/images/urls';
import { authStore } from '@/stores/authStore';
import { QueryKeys } from './keys';
import { queryConfigs } from './configs';

// ScreensaverData.kt:11-32 (the palette wraps its swatches under `image`).
export interface ScreensaverPalette {
	image?: PaletteColors;
}

export interface ScreensaverItem {
	aspectRatio: number;
	src: string;
	color_palette?: ScreensaverPalette | null;
	meta: {
		title: string;
		logo?: {
			aspectRatio: number;
			src: string;
			color_palette?: ScreensaverPalette | null;
		} | null;
	};
}

interface ScreensaverResponse {
	data?: ScreensaverItem[];
}

async function fetchScreensaver(): Promise<ScreensaverItem[]> {
	const response = await apiFetch<ScreensaverResponse>({
		path: '/api/v1/setup/screensaver',
		method: 'GET',
	});

	return response?.data ?? [];
}

// ScreensaverStore.kt:67,208-215: fetched once per server, never refreshed during a session.
export function useScreensaverQuery() {
	const enabled = computed(() => Boolean(authStore.accessToken.value && authStore.serverUrl.value));

	return useQuery({
		queryKey: computed(() => [...QueryKeys.screensaver(), authStore.serverUrl.value ?? '']),
		queryFn: fetchScreensaver,
		enabled,
		...queryConfigs.infinite,
	});
}
