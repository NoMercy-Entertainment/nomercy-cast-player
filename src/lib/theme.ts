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

// CastGroundColor.kt:11-60: lightness capped (0.3), hue and saturation kept, a darker color unchanged.
export function constrainGroundColor(hex: string, maxLightness = 0.3): string {
	const n = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);
	const r = ((n >> 16) & 0xFF) / 255;
	const g = ((n >> 8) & 0xFF) / 255;
	const b = (n & 0xFF) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const lightness = (max + min) / 2;

	if (lightness <= maxLightness)
		return hex;

	const delta = max - min;
	const saturation = delta === 0
		? 0
		: delta / (1 - Math.abs(2 * lightness - 1));
	let hue = 0;

	if (delta !== 0) {
		if (max === r) {
			hue = 60 * (((g - b) / delta + 6) % 6);
		} else if (max === g) {
			hue = 60 * ((b - r) / delta + 2);
		} else {
			hue = 60 * ((r - g) / delta + 4);
		}
	}

	const chroma = (1 - Math.abs(2 * maxLightness - 1)) * saturation;
	const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
	const m = maxLightness - chroma / 2;
	const sectors = [
		[chroma, x, 0],
		[x, chroma, 0],
		[0, chroma, x],
		[0, x, chroma],
		[x, 0, chroma],
		[chroma, 0, x],
	] as const;
	const sector = sectors[Math.min(5, Math.floor(hue / 60))] ?? sectors[0];
	const channel = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, '0');

	return `#${sector.map(channel).join('')}`;
}

export function clearThemeColor(): void {
	document.documentElement.style.removeProperty('--color-primary');
}
