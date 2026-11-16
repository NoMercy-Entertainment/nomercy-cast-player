<script setup lang="ts">
import { ref } from 'vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import PlaygroundRail from './PlaygroundRail.vue';

/**
 * Dev-only focus playground per spec §13 Phase 3 verification gate.
 * Lives at /__focus in dev so QA can walk every group type without
 * needing a live cast session.
 */

const containerEl = ref<HTMLElement | null>(null);

useFocusGroup({
	type: 'vertical',
	restorationKey: 'focus-playground-root',
	initialFocusKey: 'row-1-card-0',
	containerEl,
});

const log = ref<string[]>([]);

function pushLog(line: string): void {
	log.value = [line, ...log.value].slice(0, 6);
}
</script>

<template>
	<main ref="containerEl" class="playground">
		<h1>Focus Playground</h1>
		<p class="hint">
			Use D-pad / arrow keys to walk groups. Enter selects. Esc/Back exits modal.
		</p>

		<PlaygroundRail row-id="row-1" :on-action="pushLog" />
		<PlaygroundRail row-id="row-2" :on-action="pushLog" />
		<PlaygroundRail row-id="row-3" :on-action="pushLog" />

		<section class="log">
			<h3>Action log</h3>
			<ol>
				<li v-for="(line, i) in log" :key="i">
					{{ line }}
				</li>
			</ol>
		</section>
	</main>
</template>

<style scoped>
.playground {
	padding: 32px;
	display: flex;
	flex-direction: column;
	gap: 24px;
	height: 100%;
	overflow: auto;
}
h1 {
	margin: 0;
}
.hint {
	color: var(--color-text-secondary);
}
.log {
	margin-top: auto;
	padding: 16px;
	background: oklch(0.18 0.01 250);
	border-radius: 12px;
	max-height: 200px;
	overflow: auto;
}
.log ol {
	margin: 0;
	padding-inline-start: 24px;
}
</style>
