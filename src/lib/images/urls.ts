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
