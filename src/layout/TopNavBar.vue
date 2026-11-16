<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFocusGroup } from '@/composables/useFocusGroup';
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
				label="Home"
				path="/"
				:active="route.path === '/'"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z" />
					</svg>
				</template>
			</NavLink>
			<NavLink
				focus-key="nav-libraries"
				label="Libraries"
				path="/libraries"
				:active="route.path.startsWith('/libraries')"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M3 7.5C3 6.7 3.7 6 4.5 6h4.2c.4 0 .7.1 1 .4l1.4 1.5c.3.3.6.4 1 .4h7.4c.8 0 1.5.7 1.5 1.5v9C21 19.3 20.3 20 19.5 20h-15A1.5 1.5 0 0 1 3 18.5v-11z" />
					</svg>
				</template>
			</NavLink>
			<NavLink
				focus-key="nav-music"
				label="Music"
				path="/music"
				:active="route.path.startsWith('/music')"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M9 18V5l12-2v13" />
						<circle cx="6" cy="18" r="3" />
						<circle cx="18" cy="16" r="3" />
					</svg>
				</template>
			</NavLink>
			<NavLink
				focus-key="nav-search"
				label=""
				path="/search"
				:icon-only="true"
				aria-label="Search"
				:active="route.path === '/search'"
				@action="(p) => router.push(p)"
			>
				<template #icon>
					<svg
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="11" cy="11" r="7" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
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
