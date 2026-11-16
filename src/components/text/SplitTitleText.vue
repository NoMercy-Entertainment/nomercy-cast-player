<script setup lang="ts">
import { computed } from 'vue';

/*
 * APK SplitTitleText.kt port. Splits a title at common separator
 * markers (":", "–", "—", "-", "and the" / language variants) so the
 * main heading shows the lead phrase at full size and the subtitle
 * after the separator at a smaller weight. Falls back to plain text
 * when no separator is found.
 */

const props = defineProps<{
	title: string | null | undefined;
	mainClass?: string;
	subtitleClass?: string;
}>();

const SPLIT_MARKERS = [':', '–', '—', '-', 'and the', 'en de', 'et le', 'und der', 'y el'];

const SPLIT_REGEX = new RegExp(
	`\\s*(${SPLIT_MARKERS.map(m => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+`,
	'i',
);

const parts = computed<{ main: string; subtitle: string | null }>(() => {
	const t = props.title?.trim();
	if (!t)
		return { main: '', subtitle: null };
	const match = SPLIT_REGEX.exec(t);
	if (!match)
		return { main: t, subtitle: null };
	const splitIndex = (match.index ?? 0) + match[0].length;
	const main = t.slice(0, match.index).trim();
	const subtitle = t.slice(splitIndex).trim();
	if (!main)
		return { main: t, subtitle: null };
	return { main, subtitle: subtitle || null };
});
</script>

<template>
	<div class="split-title">
		<span class="split-main" :class="[mainClass]">{{ parts.main }}</span>
		<span
			v-if="parts.subtitle"
			class="split-subtitle"
			:class="[subtitleClass]"
		>
			{{ parts.subtitle }}
		</span>
	</div>
</template>

<style scoped>
.split-title {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.split-main {
	font-size: 28px;
	font-weight: 600;
	line-height: 1.05;
	color: var(--cast-text-primary);
}
.split-subtitle {
	font-size: 19px;
	font-weight: 500;
	line-height: 1.2;
	color: oklch(0.9 0.005 250);
}
</style>
