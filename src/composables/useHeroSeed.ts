import { computed, onActivated, onDeactivated, watch } from 'vue';
import type { Ref } from 'vue';
import { focusedCardStore } from '@/stores/focusedCardStore';
import type { FocusedCardData } from '@/stores/focusedCardStore';
import type { Component } from '@/server-components/types';

/**
 * Walks the server-driven home/library/music components and seeds the
 * focusedCardStore with the first card that has a backdrop or poster,
 * so the HomeHero never paints empty while the user is still on the
 * topnav. Mirrors APK TvHomeScreen.kt's `firstItem` seed.
 */

interface SeedItem {
	component: string;
	props?: {
		title?: string;
		data?: FocusedCardData;
		items?: SeedItem[];
	};
}

interface MusicSeed extends FocusedCardData {
	name?: string;
	cover?: string;
	description?: string;
}

export function musicHero(card: MusicSeed) {
	return {
		id: card.id,
		title: card.name ?? card.title,
		overview: card.description ?? card.overview,
		backdrop: card.cover,
		logo: card.logo,
		artist: card.artist,
		link: card.link,
		type: card.type,
		color_palette: card.color_palette,
	} as const satisfies FocusedCardData;
}

// Home is a lolomo of carousels of cards. The hero starts on the first card of the first row, art or not (NMLolomo.kt:194-198).
function firstCard(items: SeedItem[]): FocusedCardData | null {
	for (const item of items) {
		const nested = item.props?.items;

		if (Array.isArray(nested)) {
			const found = firstCard(nested);

			if (found)
				return found;

			continue;
		}

		const data = item.props?.data;

		if (!data) continue;

		// A music card draws its cover as the hero backdrop (NMLolomo.kt:151-162).
		return (data as MusicSeed).cover && !data.backdrop && !data.poster
			? musicHero(data as MusicSeed)
			: data;
	}

	return null;
}

export function useHeroSeed(components: Ref<Component[]>): void {
	const seedCard = computed<FocusedCardData | null>(() =>
		firstCard(components.value as SeedItem[]),
	);

	// LaunchedEffect(rows): a new page re-seeds, a refetch of the same first card does not.
	let seededKey: string | null = null;

	function seed(card: FocusedCardData | null): void {
		if (!card) return;

		const key = `${card.id ?? ''}|${card.title ?? ''}`;

		if (key === seededKey) return;

		seededKey = key;
		focusedCardStore.seed(card);
	}

	watch(seedCard, seed, { immediate: true });

	// A kept-alive page set aside lost the theme to the page in front (InfoScreen clears it); coming back seeds it again.
	let setAside = false;

	onDeactivated(() => {
		setAside = true;
	});
	onActivated(() => {
		if (!setAside) return;

		setAside = false;
		seededKey = null;
		seed(seedCard.value);
	});
}
