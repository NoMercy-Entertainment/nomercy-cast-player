<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
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
const containerEl = ref<HTMLElement | null>(null);
const settingsGroup = useFocusGroup({
	type: 'vertical',
	restorationKey: 'settings-list',
	containerEl,
	onEscape: dir => (dir === 'up' ? focusTopnav() : false),
});

useNavFocusBridge(settingsGroup);

const autoSkipEl = ref<HTMLElement | null>(null);
const themeEl = ref<HTMLElement | null>(null);
const subtitleEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'settings-auto-skip',
	el: autoSkipEl,
	onAction: () => {
		settingsStore.autoSkipChapters.value = !settingsStore.autoSkipChapters.value;
	},
});

useFocusEntry({
	key: 'settings-theme',
	el: themeEl,
	onAction: () => {
		settingsStore.useAutoThemeColors.value = !settingsStore.useAutoThemeColors.value;
	},
});

useFocusEntry({
	key: 'settings-subs',
	el: subtitleEl,
	onAction: () => {
		settingsStore.subtitleHints.value = !settingsStore.subtitleHints.value;
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
		return 'Sending…';
	if (sendState.value === 'sent')
		return `Sent. Report ${diagnosticsSender.lastReportId.value}`;
	if (sendState.value === 'failed')
		return `Not sent. ${diagnosticsSender.lastError.value}`;
	return 'Show what a report would contain, then decide whether to send it';
});

useFocusEntry({
	key: 'settings-diagnostics',
	order: 1,
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
	order: 2,
	enabled: hasPending,
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
	order: 3,
	enabled: hasPending,
	el: sendEl,
	onAction: () => void diagnosticsSender.confirmSend(),
});

useFocusEntry({
	key: 'settings-diagnostics-cancel',
	order: 4,
	enabled: hasPending,
	el: cancelEl,
	onAction: () => diagnosticsSender.discard(),
});
</script>

<template>
	<div class="settings-screen nm-page-screen">
		<SetupBackdrop />
		<header class="nm-page-header settings-header">
			<h1>Settings</h1>
		</header>
		<div ref="containerEl" class="settings-list nm-list">
			<button
				ref="autoSkipEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="settingsStore.autoSkipChapters.value = !settingsStore.autoSkipChapters.value"
			>
				<div class="row-text">
					<p class="row-primary">
						Auto-skip intros and credits
					</p>
					<p class="row-secondary">
						When a chapter is tagged as intro or credits, jump to the end automatically
					</p>
				</div>
				<span class="toggle" :class="[{ on: settingsStore.autoSkipChapters.value }]">
					<span class="thumb" />
				</span>
			</button>

			<button
				ref="themeEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="settingsStore.useAutoThemeColors.value = !settingsStore.useAutoThemeColors.value"
			>
				<div class="row-text">
					<p class="row-primary">
						Use auto theme colours
					</p>
					<p class="row-secondary">
						Pull accent from the focused poster's palette
					</p>
				</div>
				<span class="toggle" :class="[{ on: settingsStore.useAutoThemeColors.value }]">
					<span class="thumb" />
				</span>
			</button>

			<button
				ref="subtitleEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="settingsStore.subtitleHints.value = !settingsStore.subtitleHints.value"
			>
				<div class="row-text">
					<p class="row-primary">
						Subtitle hints
					</p>
					<p class="row-secondary">
						Show subtitle availability badge on cards
					</p>
				</div>
				<span class="toggle" :class="[{ on: settingsStore.subtitleHints.value }]">
					<span class="thumb" />
				</span>
			</button>

			<button
				ref="diagnosticsEl"
				class="nm-list-row"
				data-focusable
				tabindex="0"
				@click.prevent="diagnosticsSender.prepare('manual')"
			>
				<div class="row-text">
					<p class="row-primary">
						Send diagnostics
					</p>
					<p class="row-secondary">
						{{ diagnosticsStatus }}
					</p>
				</div>
			</button>

			<template v-if="hasPending">
				<pre
					ref="previewEl"
					class="diagnostics-preview"
					data-focusable
					tabindex="0"
					aria-label="Diagnostics payload preview. Press OK to scroll."
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
							Send this report now
						</p>
						<p class="row-secondary">
							Nothing leaves this device until you choose this
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
							{{ sendState === 'sent' ? 'Close' : 'Cancel' }}
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
}
.toggle {
	width: 44px;
	height: 24px;
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
	top: 2px;
	left: 2px;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: #fff;
	transition: transform var(--motion-fast);
}
.toggle.on .thumb {
	transform: translateX(20px);
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
