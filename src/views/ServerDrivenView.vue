<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import Resolver from '@/server-components/Resolver.vue';
import Skeleton from '@/components/feedback/Skeleton.vue';
import EmptyState from '@/components/feedback/EmptyState.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import type { Component } from '@/server-components/types';

/**
 * Shared scaffolding for any server-driven view (libraries, library,
 * info, person, search, music). Vue auto-unwraps refs at template prop
 * boundaries, so we type the props as already-unwrapped values.
 */
const props = defineProps<{
	restorationKey: string;
	data: Component[] | undefined;
	isLoading: boolean;
	isFetching?: boolean;
	error?: Error | null;
	refetch?: () => void;
	emptyMessage?: string;
	errorContext?: string;
}>();

const { t } = useTranslation();
const containerEl = ref<HTMLElement | null>(null);

useFocusGroup({
	type: 'vertical',
	restorationKey: props.restorationKey,
	containerEl,
});

const components = computed(() => props.data ?? []);
const isInitialLoad = computed(() => props.isLoading && !props.data);
const errVal = computed(() => props.error ?? null);
</script>

<template>
	<div ref="containerEl" class="server-driven nm-no-scrollbar">
		<ErrorPanel
			v-if="errVal"
			:error="errVal"
			:retry="refetch"
			:context="errorContext"
		/>
		<template v-else-if="isInitialLoad">
			<Skeleton type="rail" :count="6" />
			<Skeleton type="rail" :count="6" />
		</template>
		<EmptyState
			v-else-if="components.length === 0"
			:message="emptyMessage ?? t('views.empty_default')"
			:action="refetch ? { label: t('common.refresh'), onAction: refetch } : undefined"
		/>
		<template v-else>
			<Resolver
				v-for="component in components"
				:key="component.id"
				:component="component"
			/>
		</template>
	</div>
</template>

<style scoped>
.server-driven {
	display: flex;
	flex-direction: column;
	gap: 32px;
	padding: 24px 0 64px;
	height: 100%;
	overflow-y: auto;
	scroll-behavior: smooth;
}
</style>
