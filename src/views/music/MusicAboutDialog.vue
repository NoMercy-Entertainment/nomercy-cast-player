<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { FocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { focusStore } from '@/stores/focusStore';

/*
 * MediaAboutButton.kt:80-111: the bio in a dialog, name over description.
 * Back closes it; OK on the text closes it too.
 */
defineProps<{ name?: string; description: string }>();

const emit = defineEmits<{ close: [] }>();

const { t } = useTranslation();

const bodyEl = ref<HTMLElement | null>(null);

const group = useFocusGroup({
	type: 'modal',
	autoFocus: false,
	onEscape: (dir) => {
		if (dir === 'back') {
			emit('close');
		}

		return true;
	},
});

const releases: Array<() => void> = [];

onMounted(() => {
	const el = bodyEl.value;

	if (!el) return;

	const entry: FocusEntry = {
		key: 'music-about-body',
		order: 0,
		enabled: true,
		el: () => el,
		isFocused: () => document.activeElement === el,
		focus: () => el.focus({ preventScroll: true }),
		blur: () => el.blur(),
		action: () => emit('close'),
	};

	releases.push(group.register(entry));
	releases.push(focusStore.registerAction(el, entry.action));
	void nextTick(() => el.focus());
});

onBeforeUnmount(() => releases.forEach((release) => release()));
</script>

<template>
	<Teleport to="body">
		<div class="about-scrim">
			<div
				ref="bodyEl"
				class="about-dialog"
				role="dialog"
				aria-modal="true"
				:aria-label="name || t('nav.about')"
				data-focusable
				tabindex="0"
			>
				<h2 v-if="name" class="about-name">
					{{ name }}
				</h2>
				<p class="about-text">
					{{ description }}
				</p>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.about-scrim {
	position: fixed;
	inset: 0;
	z-index: 150;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.55);
}
.about-dialog {
	box-sizing: border-box;
	width: 640px;
	max-height: 520px;
	overflow-y: auto;
	padding: 24px;
	border-radius: 16px;
	background: var(--nm-surface);
	color: var(--cast-text-primary);
	outline: none;
}
.about-dialog:focus-visible {
	box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
}
.about-name {
	margin: 0 0 12px;
	font-size: 22px;
	font-weight: 700;
}
.about-text {
	margin: 0;
	font-size: 14px;
	line-height: 22px;
	color: rgba(255, 255, 255, 0.9);
}
</style>
