<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useServerInfoQuery } from '@/queries/useServerInfoQuery';
import LoadingIndicator from '@/components/feedback/LoadingIndicator.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import SetupBackdrop from '@/components/SetupBackdrop.vue';

/*
 * Server info — APK dashboard/serverInfo/tv/ServerInfoScreen.kt parity.
 * Shows the connected server's name, version, uptime, OS, arch, CPU,
 * GPU. Read-only. Destructive actions (pause / shutdown) live on the
 * mobile dashboard only.
 */

const { t } = useTranslation();
const { data, isLoading, error, refetch } = useServerInfoQuery();
const info = computed(() => data.value ?? null);

const now = ref(Date.now());
let tickTimer: number | null = null;
onMounted(() => {
	tickTimer = window.setInterval(() => {
		now.value = Date.now();
	}, 1000);
});
onUnmounted(() => {
	if (tickTimer !== null)
		window.clearInterval(tickTimer);
});

function formatUptime(bootIso: string | undefined, currentMs: number): string {
	if (!bootIso)
		return '—';
	const boot = Date.parse(bootIso);
	if (!Number.isFinite(boot))
		return '—';
	const seconds = Math.max(0, Math.floor((currentMs - boot) / 1000));
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (d > 0)
		return `${d}d ${h}h ${m}m`;
	if (h > 0)
		return `${h}h ${m}m`;
	if (m > 0)
		return `${m}m ${s}s`;
	return `${s}s`;
}

const uptime = computed(() => formatUptime(info.value?.bootTime, now.value));
</script>

<template>
	<div class="server-info-screen nm-page-screen">
		<SetupBackdrop />
		<header class="nm-page-header server-content">
			<h1>{{ t('views.profile.server_info') }}</h1>
		</header>

		<LoadingIndicator v-if="isLoading && !info" />
		<ErrorPanel
			v-else-if="error"
			:error="error as Error"
			:retry="() => refetch()"
			:context="t('views.profile.server_info_error')"
		/>
		<div v-else-if="info" class="card server-content">
			<h2 class="server-name">
				{{ info.server }}
			</h2>
			<dl class="kv">
				<dt>{{ t('views.profile.status') }}</dt>
				<dd class="status-online">
					{{ t('views.profile.online') }}
				</dd>
				<dt>{{ t('about.version') }}</dt>
				<dd>{{ info.version }}</dd>
				<dt>{{ t('about.uptime') }}</dt>
				<dd>{{ uptime }}</dd>
				<dt>{{ t('dashboard.system_info.os') }}</dt>
				<dd>{{ info.osVersion || info.os }}</dd>
				<dt>{{ t('dashboard.system_info.architecture') }}</dt>
				<dd>{{ info.arch }}</dd>
				<dt v-if="info.cpu.length">
					{{ t('dashboard.system_info.cpu') }}
				</dt>
				<dd v-if="info.cpu.length">
					{{ info.cpu.join(', ') }}
				</dd>
				<dt v-if="info.gpu.length">
					{{ t('dashboard.system_info.gpu') }}
				</dt>
				<dd v-if="info.gpu.length">
					{{ info.gpu.join(', ') }}
				</dd>
			</dl>
		</div>

		<p class="hint server-content">
			{{ t('views.profile.switch_servers_hint') }}
		</p>
	</div>
</template>

<style scoped>
.server-info-screen {
	position: relative;
}
.server-content {
	position: relative;
	z-index: 1;
}
.card {
	max-width: 70%;
	margin: 0 auto 24px;
	padding: 28px 32px;
	background: oklch(0.18 0.01 250 / 0.85);
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 14px;
	color: var(--cast-text-primary);
}
.server-name {
	margin: 0 0 16px;
	font-size: 22px;
	font-weight: 700;
	color: var(--color-primary, oklch(0.7 0.2 285));
}
.kv {
	margin: 0;
	display: grid;
	grid-template-columns: 140px 1fr;
	row-gap: 4px;
	column-gap: 12px;
}
.kv dt {
	font-size: 14px;
	font-weight: 500;
	color: oklch(0.75 0.005 250);
}
.kv dd {
	margin: 0;
	font-size: 14px;
	font-weight: 500;
	color: oklch(0.95 0.005 250);
	word-break: break-word;
}
.status-online {
	color: oklch(0.75 0.18 145);
	font-weight: 600;
}
.hint {
	max-width: 920px;
	margin: 0 auto;
	font-size: 13px;
	color: oklch(0.7 0.005 250);
}
</style>
