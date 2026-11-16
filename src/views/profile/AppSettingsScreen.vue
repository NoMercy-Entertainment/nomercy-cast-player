<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { focusTopnav, useNavFocusBridge } from '@/composables/useNavFocusBridge';
import { settingsStore } from '@/stores/settingsStore';
import SetupBackdrop from '@/components/SetupBackdrop.vue';
import { diagnosticsSender } from '@/lib/diagnostics/sender';

/*
 * App settings — mirrors APK preferences/display/tv/AppSettingsScreen.kt:
 *   - Auto-skip chapters toggle (intro / credits)
 *   - Auto theme colours toggle (palette-tinted accent)
 *   - Subtitle hints toggle (badge cards with subs available)
 *
 * Settings persist to localStorage via settingsStore. The auto-skip
 * pref drives ChapterAutoSkipPlugin's userPrefAutoSkip flag.
 */
// A category narrows the rows to that pane; none shows every row, as before.
const props = defineProps<{ category?: string }>();
const emit = defineEmits<{ escapeLeft: [] }>();
const { t } = useTranslation();

const containerEl = ref<HTMLElement | null>(null);
const settingsGroup = useFocusGroup({
	type: 'vertical',
	restorationKey: 'settings-list',
	containerEl,
	onEscape: (dir) => {
		if (dir === 'up')
			return focusTopnav();
		if (dir === 'left' && props.category !== undefined) {
			emit('escapeLeft');
			return true;
		}
		return false;
	},
});

if (props.category === undefined)
	useNavFocusBridge(settingsGroup);

const shows = (key: string): boolean => props.category === undefined || props.category === key;
const inDisplay = computed(() => shows('display'));
const inPlayback = computed(() => shows('playback'));
const inPrivacy = computed(() => shows('privacy'));

const autoSkipEl = ref<HTMLElement | null>(null);
const themeEl = ref<HTMLElement | null>(null);
const subtitleEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'settings-auto-skip',
	group: settingsGroup,
	enabled: inPlayback,
	el: autoSkipEl,
	onAction: () => {
		settingsStore.autoSkipChapters.value = !settingsStore.autoSkipChapters.value;
	},
});

useFocusEntry({
	key: 'settings-theme',
	group: settingsGroup,
	enabled: inDisplay,
	el: themeEl,
	onAction: () => {
		settingsStore.useAutoThemeColors.value = !settingsStore.useAutoThemeColors.value;
	},
});

useFocusEntry({
	key: 'settings-subs',
	group: settingsGroup,
	enabled: inDisplay,
	el: subtitleEl,
	onAction: () => {
		settingsStore.subtitleHints.value = !settingsStore.subtitleHints.value;
	},
});

const crashEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'settings-crash-reports',
	group: settingsGroup,
	enabled: inPrivacy,
	el: crashEl,
	onAction: () => {
		settingsStore.crashReports.value = !settingsStore.crashReports.value;
	},
});

const diagnosticsEl = ref<HTMLElement | null>(null);
const previewEl = ref<HTMLElement | null>(null);
const sendEl = ref<HTMLElement | null>(null);
const cancelEl = ref<HTMLElement | null>(null);

const pendingReport = diagnosticsSender.pending;
const sendState = diagnosticsSender.state;
const hasPending = computed(() => pendingReport.value !== null);
const previewText = computed(() =>
	pendingReport.value ? JSON.stringify(pendingReport.value, null, 2) : '',
);
const diagnosticsStatus = computed(() => {
	if (sendState.value === 'sending')
		return t('views.profile.diag_sending');
	if (sendState.value === 'sent')
		return t('views.profile.diag_sent', { id: diagnosticsSender.lastReportId.value });
	if (sendState.value === 'failed')
		return t('views.profile.diag_failed', { error: diagnosticsSender.lastError.value });
	return t('views.profile.diag_idle');
});

useFocusEntry({
	key: 'settings-diagnostics',
	group: settingsGroup,
	order: 1,
	enabled: inPrivacy,
	el: diagnosticsEl,
	onAction: () => {
		diagnosticsSender.prepare('manual');
		void nextTick(() => settingsGroup.focusByKey('settings-diagnostics-preview'));
	},
});

// Enter pages the payload so a long report stays readable on a remote, and
// Down still walks on to the two decision rows.
useFocusEntry({
	key: 'settings-diagnostics-preview',
	group: settingsGroup,
	order: 2,
	enabled: computed(() => hasPending.value && inPrivacy.value),
	el: previewEl,
	onAction: () => {
		const el = previewEl.value;
		if (!el)
			return;
		const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
		el.scrollTop = atEnd ? 0 : el.scrollTop + Math.round(el.clientHeight * 0.9);
	},
});

useFocusEntry({
	key: 'settings-diagnostics-send',
	group: settingsGroup,
	order: 3,
	enabled: computed(() => hasPending.value && inPrivacy.value),
	el: sendEl,
	onAction: () => void diagnosticsSender.confirmSend(),
});

useFocusEntry({
	key: 'settings-diagnostics-cancel',
	group: settingsGroup,
	order: 4,
	enabled: computed(() => hasPending.value && inPrivacy.value),
	el: cancelEl,
	onAction: () => diagnosticsSender.discard(),
});
</script>

<template>
	<div class="settings-screen" :class="[{ 'nm-page-screen': props.category === undefined }]">
		<SetupBackdrop v-if="props.category === undefined" />
		<header v-if="props.category === undefined" class="nm-page-header settings-header">
			<h1>{{ t('views.profile.settings') }}</h1>
		</header>
		<div ref="containerEl" class="settings-list nm-list">
			<button
				v-show="inPlayback"
				ref="autoSkipEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="settingsStore.autoSkipChapters.value = !settingsStore.autoSkipChapters.value"
			>
				<div class="row-text">
					<p class="row-primary">
						{{ t('views.profile.auto_skip') }}
					</p>
					<p class="row-secondary">
						{{ t('views.profile.auto_skip_hint') }}
					</p>
				</div>
				<span class="toggle" :class="[{ on: settingsStore.autoSkipChapters.value }]">
					<span class="thumb" />
				</span>
			</button>

			<button
				v-show="inDisplay"
				ref="themeEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="settingsStore.useAutoThemeColors.value = !settingsStore.useAutoThemeColors.value"
			>
				<div class="row-text">
					<p class="row-primary">
						{{ t('views.profile.auto_theme') }}
					</p>
					<p class="row-secondary">
						{{ t('views.profile.auto_theme_hint') }}
					</p>
				</div>
				<span class="toggle" :class="[{ on: settingsStore.useAutoThemeColors.value }]">
					<span class="thumb" />
				</span>
			</button>

			<button
				v-show="inDisplay"
				ref="subtitleEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="settingsStore.subtitleHints.value = !settingsStore.subtitleHints.value"
			>
				<div class="row-text">
					<p class="row-primary">
						{{ t('views.profile.subtitle_hints') }}
					</p>
					<p class="row-secondary">
						{{ t('views.profile.subtitle_hints_hint') }}
					</p>
				</div>
				<span class="toggle" :class="[{ on: settingsStore.subtitleHints.value }]">
					<span class="thumb" />
				</span>
			</button>

			<button
				v-show="inPrivacy"
				ref="crashEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				role="switch"
				:aria-checked="settingsStore.crashReports.value"
				@click.prevent="settingsStore.crashReports.value = !settingsStore.crashReports.value"
			>
				<div class="row-text">
					<p class="row-primary">
						{{ t('about.crash_setting_label') }}
					</p>
					<p class="row-secondary">
						{{ t('views.profile.crash_reports_hint') }}
					</p>
				</div>
				<span class="toggle" :class="[{ on: settingsStore.crashReports.value }]">
					<span class="thumb" />
				</span>
			</button>

			<button
				v-show="inPrivacy"
				ref="diagnosticsEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="diagnosticsSender.prepare('manual')"
			>
				<div class="row-text">
					<p class="row-primary">
						{{ t('about.send_diagnostics') }}
					</p>
					<p class="row-secondary">
						{{ diagnosticsStatus }}
					</p>
				</div>
			</button>

			<template v-if="hasPending && inPrivacy">
				<pre
					ref="previewEl"
					class="diagnostics-preview"
					data-focusable
					tabindex="0"
					:aria-label="t('views.profile.diag_preview')"
				>{{ previewText }}</pre>

				<button
					v-if="sendState !== 'sent'"
					ref="sendEl"
					class="nm-list-row diagnostics-confirm"
					data-focusable
					tabindex="0"
					:disabled="sendState === 'sending'"
					@click.prevent="diagnosticsSender.confirmSend()"
				>
					<div class="row-text">
						<p class="row-primary">
							{{ t('views.profile.diag_send_now') }}
						</p>
						<p class="row-secondary">
							{{ t('views.profile.diag_send_now_hint') }}
						</p>
					</div>
				</button>

				<button
					ref="cancelEl"
					class="nm-list-row"
					data-focusable
					tabindex="0"
					@click.prevent="diagnosticsSender.discard()"
				>
					<div class="row-text">
						<p class="row-primary">
							{{ sendState === 'sent' ? t('common.close') : t('common.cancel') }}
						</p>
					</div>
				</button>
			</template>
		</div>
	</div>
</template>

<style scoped>
.settings-screen {
	position: relative;
}
.settings-header,
.settings-list {
	position: relative;
	z-index: 1;
}
.settings-list {
	gap: 16px;
}
.row-text {
	flex: 1;
	text-align: left;
}
.row-primary {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
}
.row-secondary {
	margin: 4px 0 0;
	font-size: 12px;
	color: oklch(0.85 0.005 250);
	opacity: 0.6;
}
.toggle {
	width: 56px;
	height: 32px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.18);
	position: relative;
	transition: background var(--motion-fast);
}
.toggle.on {
	background: var(--color-primary, oklch(0.7 0.2 285));
}
.thumb {
	position: absolute;
	top: 4px;
	left: 4px;
	width: 24px;
	height: 24px;
	border-radius: 50%;
	background: var(--nm-toggle-thumb-bg);
	transition: transform var(--motion-fast);
}
.toggle.on .thumb {
	transform: translateX(24px);
}
.diagnostics-preview {
	margin: 12px 0;
	padding: 20px 24px;
	max-height: 40vh;
	overflow-y: auto;
	border-radius: 12px;
	background: oklch(0.18 0.01 250);
	color: oklch(0.96 0.005 250);
	font-family: ui-monospace, 'Cascadia Mono', 'Consolas', monospace;
	font-size: 20px;
	line-height: 1.5;
	white-space: pre-wrap;
	word-break: break-word;
	text-align: left;
}
.diagnostics-preview:focus-visible,
.diagnostics-confirm:focus-visible {
	outline: 3px solid var(--color-primary, oklch(0.7 0.2 285));
	outline-offset: 2px;
}
</style>
