import type { PaletteColors } from '@/lib/images/urls';
import { applyThemeColor } from '@/lib/theme';
import { ref, watch } from 'vue';

export interface FocusedCardData {
	id?: string;
	title?: string;
	overview?: string;
	backdrop?: string;
	poster?: string;
	logo?: string;
	link?: string;
	// The artist byline of a music hero (VideoMusicHeroSection.kt:171-183).
	artist?: string;
	year?: number | string;
	type?: string;
	have_items?: number;
	number_of_items?: number;
	color_palette?: {
		backdrop?: PaletteColors;
		poster?: PaletteColors;
		logo?: PaletteColors;
		still?: PaletteColors;
		cover?: PaletteColors;
		image?: PaletteColors;
	};
}

const _activeCard = ref<FocusedCardData | null>(null);
const _debouncedCard = ref<FocusedCardData | null>(null);
// HeroSelectionTiming.kt:27-29: a move along a row updates the hero fast, a row change a touch later.
const HORIZONTAL_DEBOUNCE_MS = 250;
const VERTICAL_DEBOUNCE_MS = 500;
let pending: number | null = null;
let lastNavDir: 'horizontal' | 'vertical' = 'horizontal';

// The info page keeps its title's color while focus moves (InfoScreen.kt:181 SetThemeColor noRemove).
let themeFollowsFocus = true;

function applyPalette(card: FocusedCardData | null): void {
	if (!themeFollowsFocus) return;

	const palette = card?.color_palette;

	// NMLolomo.kt:150-172: a video hero takes its poster palette, a music hero its cover.
	applyThemeColor(palette?.poster ?? palette?.cover ?? null);
}

// HeroSelectionTiming.kt:33,40-43 pacedHero: a change shows at once, then holds, and only the newest card follows.
export const HERO_CHANGE_MS = 1400;
let holdTimer: number | null = null;
let held: { card: FocusedCardData | null } | null = null;

function showHero(card: FocusedCardData | null): void {
	_debouncedCard.value = card;
	applyPalette(card);

	holdTimer = window.setTimeout(() => {
		holdTimer = null;

		if (!held) return;

		const next = held.card;

		held = null;
		showHero(next);
	}, HERO_CHANGE_MS);
}

function paceHero(card: FocusedCardData | null): void {
	if (holdTimer === null) {
		showHero(card);

		return;
	}

	held = { card };
}

// A seed shows at once; the watch below must not debounce it a second time.
let seededCard: FocusedCardData | null | undefined;

watch(_activeCard, (next) => {
	if (pending !== null) {
		window.clearTimeout(pending);
		pending = null;
	}

	if (seededCard !== undefined && next === seededCard) {
		seededCard = undefined;

		return;
	}

	seededCard = undefined;

	const delay = lastNavDir === 'vertical'
		? VERTICAL_DEBOUNCE_MS
		: HORIZONTAL_DEBOUNCE_MS;

	pending = window.setTimeout(() => {
		pending = null;
		paceHero(next);
	}, delay);
}, { flush: 'post' });

export const focusedCardStore = {
	activeCard: _activeCard,
	debouncedCard: _debouncedCard,
	setActive(card: FocusedCardData | null): void {
		_activeCard.value = card;
	},
	seed(card: FocusedCardData | null): void {
		seededCard = card;
		_activeCard.value = card;
		held = null;

		if (holdTimer !== null) {
			window.clearTimeout(holdTimer);
			holdTimer = null;
		}

		if (pending !== null) {
			window.clearTimeout(pending);
			pending = null;
		}

		if (card) {
			showHero(card);

			return;
		}

		_debouncedCard.value = null;
		applyPalette(null);
	},
	setThemeFollowsFocus(follows: boolean): void {
		themeFollowsFocus = follows;
	},
	setNavDirection(dir: 'horizontal' | 'vertical'): void {
		lastNavDir = dir;
	},
};
