import { shallowRef } from 'vue';
import { settingsStore } from '@/stores/settingsStore';
import type { JsonValue } from '@/types/cast';

/**
 * The 22 account settings the KMP app syncs (SyncedSettingsRegistry.kt:60-83), read from
 * app_config `settings` only. Each value has the native validator; a value that fails it is
 * skipped, never applied (SettingsSyncEngine.kt:304-337). The receiver never writes back.
 */
type Check = (value: JsonValue) => boolean;

const bool: Check = (v) => typeof v === 'boolean';

function int(min: number, max: number): Check {
	return (v) =>
		typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

function num(min: number, max: number): Check {
	return (v) =>
		typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

const oneOf = (...options: string[]): Check => (v) => typeof v === 'string' && options.includes(v);
const text = (max: number): Check => (v) => typeof v === 'string' && v.length <= max;
const language: Check = (v) => v === null || text(16)(v);
const styleObject: Check = (v) =>
	typeof v === 'object' && v !== null && !Array.isArray(v) &&
	new TextEncoder().encode(JSON.stringify(v)).length <= 2048;

const CHECKS = {
	autoThemeColors: bool,
	showBackdrops: bool,
	keepAlive: bool,
	crossfadeEnabled: bool,
	autoSkipChapters: bool,
	lyricsVisible: bool,
	screensaverDelay: int(0, 240),
	videoSeekStep: int(1, 120),
	crossfadeDuration: num(0, 12),
	mosaicStyle: oneOf('fan', 'split', 'poster'),
	colorScheme: oneOf('dark', 'light', 'system'),
	timeChoice: oneOf('duration', 'remaining'),
	colorTheme: text(64),
	defaultAudioLanguage: language,
	defaultSubtitleLanguage: language,
	useOverlayCarouselButtons: bool,
	percentageColors: bool,
	autoFullscreen: bool,
	defaultToLatestSeason: bool,
	strength: int(0, 1000),
	surface: text(64),
	subtitleStyle: styleObject,
} as const satisfies Record<string, Check>;

type SyncedKey = keyof typeof CHECKS;

/** Every valid synced value the last app_config answer held, by key. */
export const syncedSettings = shallowRef<Partial<Record<SyncedKey, JsonValue>>>({});

function unwrap(entry: JsonValue | undefined): JsonValue | undefined {
	return typeof entry === 'object' && entry !== null && !Array.isArray(entry) && 'value' in entry
		? entry.value
		: entry;
}

export function applySyncedSettings(raw: Record<string, JsonValue> | undefined): void {
	const valid: Partial<Record<SyncedKey, JsonValue>> = {};

	for (const key of Object.keys(CHECKS) as SyncedKey[]) {
		const value = unwrap(raw?.[key]);

		if (value !== undefined && CHECKS[key](value)) {
			valid[key] = value;
		}
	}

	syncedSettings.value = valid;

	if (typeof valid.autoSkipChapters === 'boolean') {
		settingsStore.autoSkipChapters.value = valid.autoSkipChapters;
	}

	if (typeof valid.autoThemeColors === 'boolean') {
		settingsStore.useAutoThemeColors.value = valid.autoThemeColors;
	}

	if (typeof valid.videoSeekStep === 'number') {
		settingsStore.videoSeekStep.value = valid.videoSeekStep;
	}

	if (typeof valid.screensaverDelay === 'number') {
		settingsStore.screensaverDelay.value = valid.screensaverDelay;
	}
}
