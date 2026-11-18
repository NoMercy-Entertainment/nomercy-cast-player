import { authStore } from '@/stores/authStore';

const ABSOLUTE_URL = /^https?:\/\//i;
const TRAILING_SLASH = /\/$/;
const TMDB_IMAGE_EXT = /\.(?:jpg|jpeg|png|webp)$/i;
const SERVER_IMAGES = '/images/';

export const TMDB_BASE = 'https://image.tmdb.org/t/p';

function pickTmdbSize(width: number | undefined): string {
	if (!width)
		return 'original';

	if (width <= 200)
		return 'w185';

	if (width <= 320)
		return 'w300';

	if (width <= 400)
		return 'w342';

	if (width <= 600)
		return 'w500';

	if (width <= 800)
		return 'w780';

	return 'original';
}

export function buildImageUrl(
	path: string | null | undefined,
	options: {
		width?: number;
		height?: number;
		quality?: number;
	} = {},
): string | null {
	if (!path)
		return null;

	if (ABSOLUTE_URL.test(path))
		return path;

	// The server's own files (music covers, artist art) live under /images/, like app-web's imageUrl.ts.
	if (path.startsWith(SERVER_IMAGES)) {
		const server = authStore.serverUrl.value?.replace(TRAILING_SLASH, '');

		return server
			? `${server}${path}`
			: null;
	}

	// TMDB-shaped paths — go straight to TMDB; the server doesn't proxy them.
	if (TMDB_IMAGE_EXT.test(path)) {
		return `${TMDB_BASE}/${pickTmdbSize(options.width)}${path.startsWith('/')
			? path
			: `/${path}`}`;
	}

	const base = authStore.serverUrl.value?.replace(TRAILING_SLASH, '') ?? '';

	if (!base)
		return null;

	const url = new URL(`${base}/api/v1/images${path.startsWith('/')
		? path
		: `/${path}`}`);

	if (options.width) {
		url.searchParams.set('w', String(options.width));
	}

	if (options.height) {
		url.searchParams.set('h', String(options.height));
	}

	if (options.quality) {
		url.searchParams.set('q', String(options.quality));
	}

	return url.toString();
}

export const POSTER_SIZE = { width: 320, height: 480 } as const;
export const BACKDROP_SIZE = { width: 1280, height: 720 } as const;
export const SQUARE_SIZE = { width: 320, height: 320 } as const;

const luminosityCache = new Map<string, number>();

export function fastLuminosity(c: string): number {
	const cached = luminosityCache.get(c);

	if (cached !== undefined)
		return cached;

	let r: number, g: number, b: number;

	if (c.charCodeAt(0) === 35) {
		// Hex: parse directly without conversion
		const hex = c.length === 4
			? `${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
			: c.substring(1, 7);
		const n = Number.parseInt(hex, 16);

		r = (n >> 16) & 0xFF;
		g = (n >> 8) & 0xFF;
		b = n & 0xFF;
	} else {
		// RGB string: extract numbers directly
		const m = c.match(/\d+/g);

		if (!m)
			return 0;

		r = Number(m[0]);
		g = Number(m[1]);
		b = Number(m[2]);
	}

	const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

	luminosityCache.set(c, lum);

	return lum;
}

export function tooLight(c: string | null | undefined, max = 130): boolean {
	return !!c && fastLuminosity(c) > max;
}

export function tooDark(c: string | null | undefined, min = 50): boolean {
	return !!c && fastLuminosity(c) < min;
}

export interface PaletteColors {
	darkMuted?: string;
	lightMuted?: string;
	darkVibrant?: string;
	lightVibrant?: string;
	primary?: string;
	dominant?: string;
}

const paletteCache = new WeakMap<PaletteColors, Map<string, string>>();

function hexToInt(c: string): number {
	const digits = c.length === 4
		? `${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`
		: c.substring(1, 7);

	return Number.parseInt(digits, 16);
}

function clampByte(v: number): number {
	return Math.min(255, Math.max(0, v));
}

// PaletteColors.kt:100-110: lightness at or past these ends is the artwork's ink or paper, not its color.
function isWhiteOrBlack(c: string): boolean {
	const n = hexToInt(c);
	const channels = [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF].map((v) => v / 255);
	const lightness = (Math.max(...channels) + Math.min(...channels)) / 2;

	return lightness <= 0.08 || lightness >= 0.9;
}

// PaletteColors.kt:60-84: the first usable swatch, scaled into the brightness range with one factor.
function pickSwatch(c: string, dark: number, light: number): string {
	const brightness = Math.floor(fastLuminosity(c));

	if (brightness > dark && brightness < light)
		return c;

	if (brightness <= 0)
		return '';

	const target = brightness >= light
		? light - 1
		: dark + 1;
	const factor = target / brightness;
	const n = hexToInt(c);

	const scale = (v: number): string => {
		const scaled = Math.floor(v * factor + 0.5);

		return clampByte(scaled).toString(16).toUpperCase().padStart(2, '0');
	};

	return `#${[(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF].map(scale).join('')}`;
}

export function pickPaletteColor(
	color_palette?: PaletteColors | null | undefined,
	dark = 40,
	light = 120,
): string {
	if (!color_palette) {
		return '';
	}

	const cacheKey = `${dark},${light}`;
	let cache = paletteCache.get(color_palette);

	if (cache) {
		const cached = cache.get(cacheKey);

		if (cached !== undefined)
			return cached;
	}

	const first = [
		color_palette.dominant,
		color_palette.primary,
		color_palette.darkVibrant,
		color_palette.lightVibrant,
		color_palette.darkMuted,
		color_palette.lightMuted,
	].find((c) => !!c && !isWhiteOrBlack(c));
	const result = first
		? pickSwatch(first, dark, light)
		: '';

	if (!cache) {
		cache = new Map();
		paletteCache.set(color_palette, cache);
	}

	cache.set(cacheKey, result);

	return result;
}

type Rgb = readonly [number, number, number];

const HEX_DIGITS = /^[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

// PaletteColors.kt:202-221: #rgb, #rrggbb or #rrggbbaa.
function parseHexRgb(c: string | null | undefined): Rgb | null {
	const digits = c?.trim().replace('#', '') ?? '';
	const full = digits.length === 3
		? [...digits].map((d) => d + d).join('')
		: digits;

	if (!HEX_DIGITS.test(full))
		return null;

	const n = Number.parseInt(full.slice(0, 6), 16);

	return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];
}

function hexSaturation(c: string): number {
	const rgb = parseHexRgb(c);

	if (!rgb)
		return 0;

	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	if (delta === 0)
		return 0;

	return (max + min) / 2 < 0.5
		? delta / (max + min)
		: delta / (2 - max - min);
}

// PaletteColors.kt:24-35: no swatch above 12% saturation means a black and white image.
export function isGrayscalePalette(palette: PaletteColors | null | undefined): boolean {
	if (!palette)
		return false;

	const swatches = [
		palette.darkVibrant,
		palette.primary,
		palette.dominant,
		palette.lightVibrant,
		palette.darkMuted,
		palette.lightMuted,
	].filter((c): c is string => !!c);

	return swatches.length > 0 && Math.max(...swatches.map(hexSaturation)) < 0.12;
}

function relativeLuminance(rgb: Rgb): number {
	const channel = (v: number): number => {
		const s = v / 255;

		return s <= 0.04045
			? s / 12.92
			: ((s + 0.055) / 1.055) ** 2.4;
	};

	return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function rgbContrast(a: Rgb, b: Rgb): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);

	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// PaletteColors.kt:119-124: WCAG contrast ratio; zero for invalid input.
export function contrastRatio(first: string, second: string): number {
	const a = parseHexRgb(first);
	const b = parseHexRgb(second);

	return a && b
		? rgbContrast(a, b)
		: 0;
}

function toHex(rgb: Rgb): string {
	return `#${rgb.map((v) => v.toString(16).toUpperCase().padStart(2, '0')).join('')}`;
}

// PaletteColors.kt:88-117: a colorless logo takes the theme, a colored one the backdrop,
// moved toward black or white until it reaches 3:1 contrast.
export function pickLogoOutlineHex(
	logoPalette: PaletteColors | null | undefined,
	backdropHex: string | null | undefined,
	themeHex: string,
): string {
	const logo = logoPalette
		? [
				logoPalette.dominant,
				logoPalette.primary,
				logoPalette.darkVibrant,
				logoPalette.lightVibrant,
				logoPalette.darkMuted,
				logoPalette.lightMuted,
			].map(parseHexRgb).find((c) => c !== null) ?? null
		: null;

	if (!logo)
		return themeHex;

	const backdrop = backdropHex && parseHexRgb(backdropHex)
		? backdropHex
		: null;
	const candidate = isGrayscalePalette(logoPalette)
		? themeHex
		: backdrop ?? themeHex;
	const outline = parseHexRgb(candidate);

	if (!outline)
		return themeHex;

	if (rgbContrast(logo, outline) >= 3)
		return candidate;

	const endpoint = relativeLuminance(logo) > 0.179
		? 0
		: 255;
	const toward = (v: number, fraction: number): number => Math.round(v + (endpoint - v) * fraction);

	for (let step = 1; step <= 255; step++) {
		const fraction = step / 255;
		const adjusted: Rgb = [
			toward(outline[0], fraction),
			toward(outline[1], fraction),
			toward(outline[2], fraction),
		];

		if (rgbContrast(logo, adjusted) >= 3)
			return toHex(adjusted);
	}

	return toHex([endpoint, endpoint, endpoint]);
}

const HEX_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

function withAlpha(hex: string | undefined, alpha: number): string | null {
	if (!hex || !HEX_COLOR.test(hex))
		return null;

	return `${hex.slice(0, 7)}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

// PalettePlaceholder.kt:66-77: top left, top right, bottom left, bottom right; null when a color is missing.
export function paletteWashCorners(palette: PaletteColors | null | undefined): string[] | null {
	const corners = [
		withAlpha(palette?.lightVibrant, 0.75),
		withAlpha(palette?.dominant, 0.70),
		withAlpha(palette?.darkVibrant, 0.80),
		withAlpha(palette?.dominant, 0.70),
	];

	return corners.every((c) => c !== null)
		? corners
		: null;
}

// The --wash-1..4 variables the .nm-palette-wash class reads; empty when the palette is incomplete.
export function paletteWashStyle(palette?: PaletteColors | null): Record<string, string> {
	const style: Record<string, string> = {};

	const corners = paletteWashCorners(palette);

	if (!corners)
		return style;

	corners.forEach((color, i) => {
		style[`--wash-${i + 1}`] = color;
	});

	style['--wash-base'] = 'transparent';
	style['--wash-glow'] = 'rgb(0 0 0 / 0.15)';

	return style;
}
