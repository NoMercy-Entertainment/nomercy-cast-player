<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import FocusableButton from '@/components/buttons/FocusableButton.vue';
import { useFocusGroup } from '@/composables/useFocusGroup';

defineProps<{
	error: Error | { message: string };
	retry?: () => void;
	context?: string;
}>();

const { t } = useTranslation();
// The panel owns its focus group, so its action takes D-pad focus on every screen.
useFocusGroup({ type: 'vertical', initialFocusKey: 'error-retry' });
</script>

<template>
	<div class="error-panel">
		<h3 class="error-title">
			{{ context ?? t('common.something_went_wrong') }}
		</h3>
		<p class="error-message">
			{{ error.message }}
		</p>
		<FocusableButton v-if="retry" focus-key="error-retry" @action="retry">
			{{ t('startup.tryAgain') }}
		</FocusableButton>
	</div>
</template>

<style scoped>
.error-panel {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: center;
	gap: 16px;
	max-width: 440px;
	padding: 96px 40px 0;
}
.error-title {
	font-size: 34px;
	line-height: 40px;
	font-weight: 800;
	color: var(--color-text-primary);
	margin: 0;
}
.error-message {
	font-size: 14px;
	color: var(--color-error);
	margin: 0;
	max-width: 60ch;
}
</style>
