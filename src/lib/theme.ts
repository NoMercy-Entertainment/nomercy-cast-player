import { pickPaletteColor } from '@/lib/images/urls';
import type { PaletteColors } from '@/lib/images/urls';

/**
 * Wraps the shared pickPaletteColor helper to apply / clear the
 * `--color-primary` CSS variable so the hero scrim, focus borders,
 * rail accents, mini-player gradient, and OSD progress bar all pick up
 * the focused card's palette from one place.
 *
 * Mirrors APK SetThemeColor / pickPaletteColor coupling — every screen
 * that swaps the active card just calls applyThemeColor(palette) once
 * and the rest of the UI updates via the cascading var(--color-primary).
 */

export type Palette = PaletteColors | null | undefined;

export function applyThemeColor(palette: Palette): void {
	const root = document.documentElement;
	const color = pickPaletteColor(palette);

	if (color) {
		root.style.setProperty('--color-primary', color);
	} else {
		root.style.removeProperty('--color-primary');
	}
}

export function clearThemeColor(): void {
	document.documentElement.style.removeProperty('--color-primary');
}
