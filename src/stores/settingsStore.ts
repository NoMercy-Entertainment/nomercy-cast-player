import { ref, watch } from 'vue';
import { setAutoSkipEnabled } from '@/players/video/ChapterAutoSkipPlugin';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';

/**
 * App settings persisted to localStorage. Mirrors APK
 * AppSettingsStore — the receiver-applicable subset of the APK toggles.
 *
 * The APK persists per-user in EncryptedSharedPreferences; the cast
 * receiver lives inside a sandboxed cast_shell webview, so we use
 * localStorage scoped per origin. Settings survive reloads within the
 * same cast session and across sessions on the same Cast device.
 */

const STORAGE_KEY = 'nm-cast-settings-v1';

interface SettingsShape {
	autoSkipChapters: boolean;
	useAutoThemeColors: boolean;
	subtitleHints: boolean;
}

const DEFAULTS: SettingsShape = {
	autoSkipChapters: false,
	useAutoThemeColors: true,
	subtitleHints: true,
};

function load(): SettingsShape {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw)
			return DEFAULTS;
		const parsed = JSON.parse(raw) as Partial<SettingsShape>;
		return { ...DEFAULTS, ...parsed };
	}
	catch {
		return DEFAULTS;
	}
}

const stored = load();

const autoSkipChapters = ref(stored.autoSkipChapters);
const useAutoThemeColors = ref(stored.useAutoThemeColors);
const subtitleHints = ref(stored.subtitleHints);

function persist(): void {
	try {
		const data: SettingsShape = {
			autoSkipChapters: autoSkipChapters.value,
			useAutoThemeColors: useAutoThemeColors.value,
			subtitleHints: subtitleHints.value,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}
	catch (error) {
		// Quota / serialization errors are non-fatal.
		recordSwallowed('settingsPersist', error);
	}
}

watch(autoSkipChapters, (next) => {
	setAutoSkipEnabled(next);
	persist();
}, { immediate: true });
watch(useAutoThemeColors, persist);
watch(subtitleHints, persist);

export const settingsStore = {
	autoSkipChapters,
	useAutoThemeColors,
	subtitleHints,
};
