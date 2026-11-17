import { computed, watch } from 'vue';
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

// Home is a lolomo of carousels of cards, so the first card sits two levels down.
function firstCard(items: SeedItem[]): FocusedCardData | null {
	for (const item of items) {
		const data = item.props?.data;

		if (data && (data.backdrop || data.poster))
			return data;

		// A music card draws its cover as the hero backdrop (NMLolomo.kt:151-162).
		if (data && (data as MusicSeed).cover)
			return musicHero(data as MusicSeed);

		const nested = item.props?.items;
		const found = Array.isArray(nested)
			? firstCard(nested)
			: null;

		if (found)
			return found;
	}

	return null;
}

export function useHeroSeed(components: Ref<Component[]>): void {
	const seedCard = computed<FocusedCardData | null>(() => {
		for (const c of components.value) {
			if (!c.props || typeof c.props !== 'object') continue;

			const items = (c.props as { items?: SeedItem[] }).items;

			if (!Array.isArray(items) || items.length === 0) continue;

			const found = firstCard(items);

			if (found)
				return found;
		}

		return null;
	});

	watch(
		seedCard,
		(card) => {
			if (card && !focusedCardStore.activeCard.value) {
				focusedCardStore.seed(card);
			}
		},
		{ immediate: true },
	);
}
