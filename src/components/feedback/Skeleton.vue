<script setup lang="ts">
defineProps<{
	type?: 'rail' | 'grid' | 'card' | 'hero' | 'list';
	count?: number;
	titled?: boolean;
}>();
</script>

<template>
	<div class="skeleton" :class="[`skeleton-${type ?? 'card'}`, { 'skeleton-titled': titled }]">
		<div v-if="titled" class="skeleton-title" />
		<div v-if="titled" class="skeleton-track">
			<div v-for="i in count ?? 6" :key="i" class="skeleton-item" />
		</div>
		<template v-else>
			<div v-for="i in count ?? 6" :key="i" class="skeleton-item" />
		</template>
	</div>
</template>

<style scoped>
/* Per spec §11.5 — static dim block, NO shimmer animation. Animations on
 * weak Cast hardware drop frames during loading exactly when the user
 * notices. */
.skeleton {
	display: flex;
	gap: 16px;
	contain: layout paint;
}
.skeleton-rail .skeleton-item {
	width: var(--rail-card-width);
	height: var(--rail-card-height);
	background: oklch(1 0 0 / 0.06);
	border-radius: var(--radius-card);
	flex-shrink: 0;
}
/* Same title line and track padding as NMCarousel, so the real rail lands on it. */
.skeleton-titled {
	flex-direction: column;
	gap: 0;
}
.skeleton-title {
	height: 36px;
	width: 160px;
	margin-left: 40px;
	box-sizing: border-box;
	border: solid transparent;
	border-width: 10px 0;
	background: oklch(1 0 0 / 0.06);
	background-clip: padding-box;
	border-radius: var(--radius-card);
}
.skeleton-track {
	display: flex;
	gap: var(--rail-card-gap);
	overflow: hidden;
	padding: 2px 40px;
	margin: -2px 0;
}
.skeleton-grid {
	display: grid;
	grid-template-columns: repeat(6, 1fr);
}
.skeleton-grid .skeleton-item {
	aspect-ratio: 2/3;
	background: oklch(1 0 0 / 0.06);
	border-radius: var(--radius-card);
}
.skeleton-card .skeleton-item {
	width: var(--rail-card-width);
	height: var(--rail-card-height);
	background: oklch(1 0 0 / 0.06);
	border-radius: var(--radius-card);
}
.skeleton-hero .skeleton-item {
	width: 100%;
	aspect-ratio: 16/9;
	background: oklch(1 0 0 / 0.06);
	border-radius: var(--radius-card);
}
.skeleton-list {
	flex-direction: column;
}
.skeleton-list .skeleton-item {
	width: 100%;
	height: 64px;
	background: oklch(1 0 0 / 0.06);
	border-radius: var(--radius-card);
}
</style>
