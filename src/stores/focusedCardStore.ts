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
	year?: number | string;
	type?: string;
	have_items?: number;
	number_of_items?: number;
	color_palette?: {
		backdrop?: {
			dominant?: string;
			light?: string;
			dark?: string;
			primary?: string;
		};
		poster?: {
			dominant?: string;
			light?: string;
			dark?: string;
			primary?: string;
		};
		logo?: {
			dominant?: string;
			light?: string;
			dark?: string;
			primary?: string;
		};
	};
}

const _activeCard = ref<FocusedCardData | null>(null);
const _debouncedCard = ref<FocusedCardData | null>(null);
const HORIZONTAL_DEBOUNCE_MS = 650;
const VERTICAL_DEBOUNCE_MS = 2000;
let pending: number | null = null;
let lastNavDir: 'horizontal' | 'vertical' = 'horizontal';

function applyPalette(card: FocusedCardData | null): void {
	const palette = card?.color_palette;

	applyThemeColor(palette?.poster ?? palette?.backdrop ?? null);
}

watch(_activeCard, (next) => {
	if (pending !== null) {
		window.clearTimeout(pending);
		pending = null;
	}

	const delay = lastNavDir === 'vertical'
		? VERTICAL_DEBOUNCE_MS
		: HORIZONTAL_DEBOUNCE_MS;

	pending = window.setTimeout(() => {
		_debouncedCard.value = next;
		applyPalette(next);
		pending = null;
	}, delay);
}, { flush: 'post' });

export const focusedCardStore = {
	activeCard: _activeCard,
	debouncedCard: _debouncedCard,
	setActive(card: FocusedCardData | null): void {
		_activeCard.value = card;
	},
	seed(card: FocusedCardData | null): void {
		_activeCard.value = card;
		_debouncedCard.value = card;
		applyPalette(card);
	},
	setNavDirection(dir: 'horizontal' | 'vertical'): void {
		lastNavDir = dir;
	},
};
