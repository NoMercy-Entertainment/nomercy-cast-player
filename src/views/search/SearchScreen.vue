<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { focusTopnav, useNavFocusBridge } from '@/composables/useNavFocusBridge';
import { useSearchQuery } from '@/queries/useSearchQuery';
import Resolver from '@/server-components/Resolver.vue';
import Skeleton from '@/components/feedback/Skeleton.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import SearchKeyboard from './SearchKeyboard.vue';

const containerEl = ref<HTMLElement | null>(null);
const screenGroup = useFocusGroup({
	type: 'horizontal',
	restorationKey: 'search-screen',
	containerEl,
	onEscape: dir => (dir === 'up' ? focusTopnav() : false),
});

useNavFocusBridge({ handle: screenGroup, containerEl });

const queryStr = ref('');
const debouncedQuery = ref('');
const mode = ref<'video' | 'music'>('video');

let debounceTimer: number | null = null;
watch(queryStr, (val) => {
	if (debounceTimer !== null)
		window.clearTimeout(debounceTimer);
	debounceTimer = window.setTimeout(() => {
		debouncedQuery.value = val;
	}, 250);
});

const queryType = computed(() => mode.value === 'music' ? 'music' : 'all');
const { data, isLoading, isFetching, error, refetch } = useSearchQuery(queryType, debouncedQuery);
const components = computed(() => data.value ?? []);

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
				<span class="query-label">Search:</span>
				<span class="query-text">{{ queryStr || '_' }}</span>
				<span v-if="mode === 'music'" class="mode-pill">Music</span>
				<span v-else class="mode-pill">Video</span>
			</header>

			<div class="results nm-no-scrollbar">
				<template v-if="!debouncedQuery">
					<p class="hint">
						Start typing to search.
					</p>
				</template>
				<template v-else-if="isLoading">
					<Skeleton type="rail" :count="6" />
				</template>
				<template v-else-if="error">
					<ErrorPanel
						:error="error as Error"
						:retry="() => refetch()"
						context="Couldn't search"
					/>
				</template>
				<template v-else-if="components.length === 0">
					<p class="hint">
						No results for "{{ debouncedQuery }}".
					</p>
				</template>
				<template v-else>
					<Resolver
						v-for="c in components"
						:key="c.id"
						:component="c"
					/>
					<p v-if="isFetching" class="refresh-hint">
						Refreshing…
					</p>
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
	grid-template-columns: minmax(360px, 25%) 1fr;
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
	align-items: baseline;
	gap: 16px;
	padding: 14px 22px;
	background: oklch(0.18 0.01 250 / 0.85);
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 12px;
}
.query-label {
	color: var(--color-text-secondary);
	font-size: 14px;
	letter-spacing: 0.04em;
}
.query-text {
	flex: 1 1 auto;
	font-size: 24px;
	font-weight: 700;
	letter-spacing: 0.5px;
	font-variant-numeric: tabular-nums;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.mode-pill {
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	padding: 4px 10px;
	border-radius: 999px;
	background: var(--color-primary, oklch(0.7 0.2 285 / 0.4));
	color: oklch(0.18 0.02 35);
}
.results {
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 24px;
}
.hint {
	color: var(--color-text-secondary);
	font-size: 18px;
}
.refresh-hint {
	color: var(--color-text-secondary);
	font-size: 13px;
}
</style>
