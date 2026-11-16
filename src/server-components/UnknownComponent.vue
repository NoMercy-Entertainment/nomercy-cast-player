<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { allowDiagnosticsWords } from '@/lib/diagnostics/censor';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

const props = defineProps<{
	type: string;
	id: string;
}>();

const { t } = useTranslation();

// A type name is server vocabulary; anything else stays out of the report.
if (/^NM[A-Za-z0-9]{1,40}$/.test(props.type))
	allowDiagnosticsWords([props.type]);
recordDiagnostic(DiagnosticsCategory.Lifecycle, DiagnosticsCode.WarningLogged, 0, 0, 0, `unknownComponent ${props.type}`);

if (import.meta.env.DEV) {
	console.warn(`[Resolver] Unknown component type "${props.type}" (id=${props.id})`);
}
</script>

<template>
	<!-- Production silently skips unknowns. Dev shows a debug card so the gap
       is visible. Add new component types as the server introduces them —
       never crash on unknowns. -->
	<div v-if="$attrs.dev || false" class="unknown-component">
		{{ t('views.unknown') }}: {{ type }} ({{ id }})
	</div>
</template>

<style scoped>
.unknown-component {
	padding: 16px;
	border-radius: var(--radius-card);
	border: 2px dashed oklch(0.5 0.15 35);
	color: oklch(0.7 0.15 35);
	font-family: monospace;
}
</style>
