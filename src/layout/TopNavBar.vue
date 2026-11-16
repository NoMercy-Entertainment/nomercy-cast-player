<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import ProfileChip from './ProfileChip.vue';
import NavLink from './NavLink.vue';
import TvMiniPlayer from './TvMiniPlayer.vue';
import { playbackStore } from '@/stores/playbackStore';
import AppLogoSquare from './AppLogoSquare.vue';

/*
 * Topnav matches APK TvNavigationBar layout:
 *   [music indicator | brand]   [Home | Libraries | Music | (search-icon)]   [profile circle]
 *      weight 1                          weight 3 (centered)                       weight 1
 *
 * Each pill carries a Moooom-equivalent icon to the left of the label,
 * 20dp white-tinted, mirrors APK TvNavigationBarButton.
 */

const { t } = useTranslation();
const navEl = ref<HTMLElement | null>(null);
const router = useRouter();
const route = useRoute();

const hasActiveTrack = computed(() => playbackStore.music.track.value != null);

useFocusGroup({
	type: 'horizontal',
	restorationKey: 'topnav',
	containerEl: navEl,
	// The page below is the cold-start focus target; the topnav only
	// receives focus when the user explicitly walks UP into it.
	autoFocus: false,
	onEscape: (dir) => {
		if (dir !== 'down')
			return false;
		const ev = new CustomEvent('cast-receiver:nav-down', {});
		window.dispatchEvent(ev);
		return true;
	},
});
</script>

<template>
	<header class="topnav">
		<div class="leading">
			<TvMiniPlayer v-if="hasActiveTrack" />
			<AppLogoSquare class="brand-logo" />
		</div>
		<nav ref="navEl" class="nav-items">
			<NavLink
				focus-key="nav-home"
				:label="t('nav.home')"
				path="/"
				:active="route.path === '/'"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<MoooomIcon icon="home1" width="20" height="20" />
				</template>
			</NavLink>
			<NavLink
				focus-key="nav-libraries"
				:label="t('nav.libraries')"
				path="/libraries"
				:active="route.path.startsWith('/libraries')"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<MoooomIcon icon="folder" width="20" height="20" />
				</template>
			</NavLink>
			<NavLink
				focus-key="nav-music"
				:label="t('nav.music')"
				path="/music"
				:active="route.path.startsWith('/music')"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<MoooomIcon icon="noteEighthPair" width="20" height="20" />
				</template>
			</NavLink>
			<NavLink
				focus-key="nav-search"
				label=""
				path="/search"
				:icon-only="true"
				:aria-label="t('nav.search')"
				:active="route.path === '/search'"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<MoooomIcon icon="searchMagnifyingGlass" width="20" height="20" />
				</template>
			</NavLink>
		</nav>
		<div class="trailing">
			<ProfileChip />
		</div>
	</header>
</template>

<style scoped>
.topnav {
	position: absolute;
	z-index: 2;
	display: grid;
	width: 100%;
	grid-template-columns: 1fr 3fr 1fr;
	align-items: center;
	padding: 0 36px;
	height: var(--topnav-height);
}
.leading {
	display: flex;
	align-items: center;
	justify-content: flex-start;
}
.brand-logo {
	width: 52px;
	height: 52px;
	object-fit: contain;
	filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4));
}
.nav-items {
	display: flex;
	justify-content: center;
	gap: 16px;
	padding: 4px 16px 8px;
}
.trailing {
	display: flex;
	justify-content: flex-end;
	align-items: center;
}
</style>
