<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { focusStore } from '@/stores/focusStore';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { focusTopnav, useNavFocusBridge } from '@/composables/useNavFocusBridge';
import { useSearchQuery } from '@/queries/useSearchQuery';
import Resolver from '@/server-components/Resolver.vue';
import { hasContent } from '@/server-components/hasContent';
import LoadingIndicator from '@/components/feedback/LoadingIndicator.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import SearchKeyboard from './SearchKeyboard.vue';

const { t } = useTranslation();
const containerEl = ref<HTMLElement | null>(null);
const screenGroup = useFocusGroup({
	type: 'horizontal',
	restorationKey: 'search-screen',
	containerEl,
	onEscape: (dir) =>
		dir === 'up'
			? focusTopnav()
			: false,
});

useNavFocusBridge({ handle: screenGroup, containerEl });

// SearchScreen.kt:60: the A key takes focus on entry, also from the top nav.
onMounted(() => {
	queueMicrotask(() => focusStore.requestFocus('kb-a'));
});

const queryStr = ref('');
const debouncedQuery = ref('');
const mode = ref<'video' | 'music'>('video');

let debounceTimer: number | null = null;

watch(queryStr, (val) => {
	if (debounceTimer !== null) {
		window.clearTimeout(debounceTimer);
	}

	// SearchViewModel.kt:29-32: 1250 ms after the last key, and nothing under 3 characters.
	debounceTimer = window.setTimeout(() => {
		debouncedQuery.value = val.length >= 3
			? val
			: '';
	}, 1250);
});

const placeholder = computed(() =>
	mode.value === 'music'
		? t('views.search.placeholder_music')
		: t('views.search.placeholder_video'));

const queryType = computed(() =>
	mode.value === 'music'
		? 'music'
		: 'all');
const { data, isLoading, error, refetch } = useSearchQuery(queryType, debouncedQuery);
const components = computed(() => data.value ?? []);
const visible = computed(() => components.value.filter(hasContent));

function appendLetter(l: string): void {
	queryStr.value += l;
}

function backspace(): void {
	queryStr.value = queryStr.value.slice(0, -1);
}

function space(): void {
	queryStr.value += ' ';
}

function setMode(next: 'video' | 'music'): void {
	mode.value = next;
}
</script>

<template>
	<div ref="containerEl" class="search">
		<aside class="left">
			<SearchKeyboard
				:mode="mode"
				@type="appendLetter"
				@backspace="backspace"
				@space="space"
				@mode="setMode"
			/>
		</aside>
		<section class="right">
			<header class="query-bar">
				<MoooomIcon icon="searchMagnifyingGlass" class="query-icon" />
				<span class="query-text" :class="{ 'query-placeholder': !queryStr }">{{ queryStr || placeholder }}</span>
			</header>

			<div class="results nm-no-scrollbar">
				<template v-if="!debouncedQuery" />
				<template v-else-if="components.length > 0">
					<Resolver
						v-for="c in visible"
						:key="c.id"
						:component="c"
					/>
				</template>
				<template v-else-if="isLoading">
					<LoadingIndicator />
				</template>
				<template v-else-if="error">
					<ErrorPanel
						:error="error as Error"
						:retry="() => refetch()"
						:context="t('views.search.error')"
					/>
				</template>
			</div>
		</section>
	</div>
</template>

<style scoped>
/*
 * APK tv/SearchScreen.kt: 25 / 75 column split. Left column houses the
 * search bar + on-screen keyboard. Right column scrolls results.
 */
.search {
	display: grid;
	grid-template-columns: calc((100vw - 72px) / 4) 1fr;
	gap: 16px;
	padding: 64px 36px 24px;
	height: 100%;
}
.left {
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding-top: 24px;
}
.right {
	display: flex;
	flex-direction: column;
	gap: 16px;
	min-height: 0;
}
.query-bar {
	display: flex;
	align-items: center;
	gap: 16px;
	width: 75%;
	height: 60px;
	padding: 0 16px;
	border-radius: 16px;
	overflow: hidden;
}
.query-icon {
	flex: none;
	color: var(--color-text-primary);
}
.query-text {
	flex: 1 1 auto;
	font-size: 14px;
	line-height: 20px;
	letter-spacing: 0.25px;
	color: var(--color-text-secondary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.query-placeholder {
	opacity: 0.7;
}
.results {
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 24px;
}
</style>
