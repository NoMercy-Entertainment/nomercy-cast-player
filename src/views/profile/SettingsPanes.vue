<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import SetupBackdrop from '@/components/SetupBackdrop.vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useNavFocusBridge } from '@/composables/useNavFocusBridge';
import AppSettingsScreen from './AppSettingsScreen.vue';
import SettingsCategories from './SettingsCategories.vue';

/*
 * AppSettingsScreen.kt:258-333: categories on the left, the open
 * category's rows on the right. The groups are Display, Playback and Privacy.
 */
const { t } = useTranslation();
const CATEGORIES = computed(() => [
	{ key: 'display', label: t('views.profile.category_display') },
	{ key: 'playback', label: t('views.profile.category_playback') },
	{ key: 'privacy', label: t('views.profile.category_privacy') },
]);

const category = ref('display');
const categories = ref<InstanceType<typeof SettingsCategories> | null>(null);

const panesGroup = useFocusGroup({ type: 'horizontal', restorationKey: 'settings-panes' });

useNavFocusBridge(panesGroup);
</script>

<template>
	<div class="settings-screen nm-page-screen">
		<SetupBackdrop />
		<div class="settings-panes">
			<div class="settings-left">
				<header class="settings-header">
					<h1>{{ t('views.profile.settings') }}</h1>
				</header>
				<SettingsCategories
					ref="categories"
					:items="CATEGORIES"
					:selected="category"
					@select="category = $event"
				/>
			</div>
			<div class="settings-right">
				<AppSettingsScreen
					:category="category"
					@escape-left="categories?.focusSelected()"
				/>
			</div>
		</div>
	</div>
</template>

<style scoped>
.settings-screen {
	position: relative;
}
.settings-panes {
	position: relative;
	z-index: 1;
	display: flex;
	height: 100%;
}
.settings-left {
	box-sizing: content-box;
	width: 320px;
	padding-right: 32px;
	flex: none;
}
.settings-header {
	margin-bottom: 24px;
}
.settings-header h1 {
	margin: 0;
	font-size: 24px;
	font-weight: 700;
}
.settings-right {
	flex: 1;
	min-width: 0;
	overflow-y: auto;
	scrollbar-width: none;
}
.settings-right::-webkit-scrollbar {
	display: none;
}
</style>
