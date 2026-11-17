<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, toRefs, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useInfoQuery } from '@/queries/useInfoQuery';
import type { InfoData } from '@/queries/useInfoQuery';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { usePacedValue } from '@/composables/usePacedValue';
import { settingsStore } from '@/stores/settingsStore';
import { focusTopnav, useNavFocusBridge } from '@/composables/useNavFocusBridge';
import { BACKDROP_SIZE, buildImageUrl } from '@/lib/images/urls';
import { applyThemeColor, clearThemeColor } from '@/lib/theme';
import { focusedCardStore } from '@/stores/focusedCardStore';
import SplitTitleText from '@/components/text/SplitTitleText.vue';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import LoadingIndicator from '@/components/feedback/LoadingIndicator.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import { apiFetch } from '@/lib/http/client';
import { updateWatchlistInAllQueries } from '@/lib/queryShim';
import { QueryKeys } from '@/queries/keys';
import { useInfoRowsQuery } from '@/queries/useInfoRowsQuery';
import { useTrailerQuery } from '@/queries/useTrailerQuery';
import TrailerOverlay from '@/players/video/TrailerOverlay.vue';
import InfoSeasons from './InfoSeasons.vue';
import { buildInfoRows } from './infoRows';

/*
 * Movie / TV detail page. Mirrors APK InfoScreen.kt:
 *   - BackdropImageWithOverlay full-bleed
 *   - HeroRow at top: logo (or title) + overview, height ~366dp
 *   - Below hero: Watch / Trailer / Add-to-Watchlist buttons stacked
 *     left, right column reserved (cast / seasons land in a follow-up)
 */
const props = defineProps<{
	type: string;
	id: string;
}>();
const API_PREFIX = /^\/api\/v1\//;
const LEADING_SLASH = /^\//;

const { t } = useTranslation();
const router = useRouter();
const { type, id } = toRefs(props);

const { data, isLoading, error, refetch } = useInfoQuery(type, id);

const info = computed(() => data.value ?? null);

// InfoScreen.kt:181-186: the poster palette only, and only while the auto theme setting is on.
watch([info, settingsStore.useAutoThemeColors], ([next, auto]) => {
	applyThemeColor(auto
		? (next?.color_palette?.poster ?? null)
		: null);
}, { immediate: true });

focusedCardStore.setThemeFollowsFocus(false);
focusedCardStore.seed(null);

onBeforeUnmount(() => {
	focusedCardStore.setThemeFollowsFocus(true);
	focusedCardStore.seed(null);
	clearThemeColor();
});

// HeroCardGate.kt:18-21: a focused movie or tv card with a backdrop replaces the title's own hero.
const wantedTitle = computed(() => {
	const card = focusedCardStore.debouncedCard.value;

	return card && (card.type === 'movie' || card.type === 'tv') && card.backdrop
		? card
		: null;
});
const focusedTitle = usePacedValue(wantedTitle);

// NMDetailActions.kt:104: the actions row hands the hero back to the base title.
function releaseHero(): void {
	focusedCardStore.setActive(null);
}

const heroTitle = computed(() => focusedTitle.value?.title ?? info.value?.title);
const heroOverview = computed(() =>
	focusedTitle.value
		? focusedTitle.value.overview
		: info.value?.overview,
);

const backdropUrl = computed(() =>
	buildImageUrl(focusedTitle.value?.backdrop ?? info.value?.backdrop ?? null, BACKDROP_SIZE),
);

const logoUrl = computed(() => buildImageUrl(
	focusedTitle.value
		? (focusedTitle.value.logo ?? null)
		: (info.value?.logo ?? null),
	{ width: 600 },
));

const watchPath = computed(() => {
	const link = info.value?.link;

	if (!link)
		return null;

	return link.endsWith('/watch')
		? link
		: `${link}/watch`;
});

// Metadata listing a trailer is not a trailer. The button waits until the
// API has one ready to play, as the KMP TV screen does, so it never opens
// nothing.
const trailerLookup = useTrailerQuery(type, id, computed(() => info.value?.videos));
const readyTrailer = computed(() => {
	const result = trailerLookup.data.value;

	return result?.state === 'available'
		? result.trailer
		: null;
});
const trailerOpen = ref(false);

// The server's rows when it honors version=lolomo; older servers get the rows built here.
const serverRows = useInfoRowsQuery(type, id);
const infoRows = computed(() => {
	if (serverRows.data.value)
		return serverRows.data.value;

	return info.value
		? buildInfoRows(info.value, {
				collections: t('views.info.collections'),
				writerDirector: t('views.info.writer_director'),
				cast: t('views.info.cast'),
				crew: t('views.info.crew'),
			})
		: [];
});

const watchlistLabel = computed(() =>
	info.value?.watchlist
		? t('components.buttons.remove_from_watchlist')
		: t('components.buttons.add_to_watchlist'),
);

const actionsEl = ref<HTMLElement | null>(null);
const actionsGroup = useFocusGroup({
	type: 'vertical',
	restorationKey: 'info-actions',
	containerEl: actionsEl,
	onEscape: (dir) =>
		dir === 'up'
			? focusTopnav()
			: false,
});

useNavFocusBridge(actionsGroup);

const watchEl = ref<HTMLElement | null>(null);
const trailerEl = ref<HTMLElement | null>(null);
const watchlistEl = ref<HTMLElement | null>(null);

useFocusEntry({
	key: 'info-watch',
	group: actionsGroup,
	enabled: computed(() => watchPath.value !== null),
	el: watchEl,
	onAction: () => {
		if (watchPath.value) {
			router.push(watchPath.value);
		}
	},
});

useFocusEntry({
	key: 'info-trailer',
	group: actionsGroup,
	enabled: computed(() => readyTrailer.value !== null),
	el: trailerEl,
	onAction: () => openTrailer(),
});

// Also bound to click. The button only renders once the lookup answers, which
// is after this screen mounted, so the focus entry's own Enter listener was
// never attached to it; the remote's Enter reaches it as a click instead.
function openTrailer(): void {
	if (readyTrailer.value) {
		trailerOpen.value = true;
	}
}

function closeTrailer(): void {
	trailerOpen.value = false;
	void nextTick(() => trailerEl.value?.focus());
}

const queryClient = useQueryClient();
const isPostingWatchlist = ref(false);

useFocusEntry({
	key: 'info-watchlist',
	group: actionsGroup,
	el: watchlistEl,
	onAction: () => {
		void toggleWatchlist();
	},
});

async function toggleWatchlist(): Promise<void> {
	if (isPostingWatchlist.value || !info.value?.link) return;

	isPostingWatchlist.value = true;
	const link = info.value.link;
	const newValue = !info.value.watchlist;
	const queryKey = [...QueryKeys.info(type.value, id.value)];

	queryClient.setQueryData<InfoData>(queryKey, (prev) => {
		if (!prev)
			return prev;

		return { ...prev, watchlist: newValue };
	});

	updateWatchlistInAllQueries(link, newValue);

	try {
		const cleanLink = link.replace(API_PREFIX, '').replace(LEADING_SLASH, '');

		await apiFetch<{ status?: string }>({
			path: `/api/v1/${cleanLink}/watch-list`,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ add: newValue }),
		});
	} catch {
		queryClient.setQueryData<InfoData>(queryKey, (prev) => {
			if (!prev)
				return prev;

			return { ...prev, watchlist: !newValue };
		});

		updateWatchlistInAllQueries(link, !newValue);
	} finally {
		isPostingWatchlist.value = false;
	}
}
</script>

<template>
	<LoadingIndicator v-if="isLoading && !info" />
	<ErrorPanel
		v-else-if="error"
		:error="error as Error"
		:retry="() => refetch()"
		:context="t('views.info.load_error')"
	/>
	<section v-else-if="info" class="info-screen">
		<div class="backdrop">
			<img
				v-if="backdropUrl"
				:src="backdropUrl"
				:alt="heroTitle ?? ''"
				loading="eager"
				decoding="async"
			>
			<div class="nm-hero-scrim" />
		</div>

		<div class="hero-row">
			<Transition name="hero-fade" mode="out-in">
				<div :key="`${heroTitle}|${logoUrl}`" class="nm-hero-title-block">
					<img
						v-if="logoUrl"
						class="nm-hero-logo"
						:src="logoUrl"
						:alt="heroTitle ?? ''"
						loading="eager"
						decoding="async"
					>
					<SplitTitleText
						v-else
						:title="heroTitle"
						main-class="nm-hero-title-main"
						subtitle-class="nm-hero-title-sub"
					/>
				</div>
			</Transition>

			<Transition name="hero-fade" mode="out-in">
				<div :key="heroOverview ?? ''" class="nm-hero-overview-block">
					<p v-if="heroOverview" class="nm-hero-overview">
						{{ heroOverview }}
					</p>
				</div>
			</Transition>
		</div>

		<div class="info-list">
			<div ref="actionsEl" class="actions" @focusin="releaseHero">
				<button
					v-if="watchPath"
					ref="watchEl"
					class="nm-pill nm-pill-primary"
					data-focusable
					tabindex="0"
					@click.prevent="watchPath && router.push(watchPath)"
				>
					<MoooomIcon icon="nmPlay" width="24" height="24" />
					{{ t('components.cards.watch') }}
				</button>
				<button
					v-if="readyTrailer"
					ref="trailerEl"
					class="nm-pill nm-pill-secondary"
					data-focusable
					tabindex="0"
					@click="openTrailer"
				>
					<MoooomIcon icon="playCircle" width="24" height="24" />
					{{ t('info.watch_trailer') }}
				</button>
				<button
					ref="watchlistEl"
					class="nm-pill nm-pill-secondary"
					data-focusable
					tabindex="0"
					@click.prevent="toggleWatchlist"
				>
					<MoooomIcon :icon="info.watchlist ? 'bookmark' : 'bookmarkAdd'" width="24" height="24" />
					{{ watchlistLabel }}
				</button>
			</div>
			<InfoSeasons
				v-if="info.seasons?.length || infoRows.length"
				:seasons="info.seasons ?? []"
				:rows="infoRows"
			/>
		</div>
		<TrailerOverlay
			v-if="trailerOpen && readyTrailer"
			:trailer="readyTrailer"
			:fallback-title="info.title ?? ''"
			@close="closeTrailer"
		/>
	</section>
</template>

<style scoped>
.info-screen {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	color: var(--cast-text-primary);
}
.backdrop {
	position: absolute;
	inset: 0;
}
.backdrop img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.hero-row {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	gap: 12px;
	height: var(--hero-height);
	width: 60%;
	padding: 0 16px 12px 40px;
	box-sizing: border-box;
}
.info-list {
	position: absolute;
	top: var(--hero-height);
	right: 0;
	bottom: 0;
	left: 0;
	z-index: 1;
	overflow-y: auto;
	padding-bottom: 120px;
	scrollbar-width: none;
}
.info-list::-webkit-scrollbar {
	display: none;
}
.hero-fade-enter-active,
.hero-fade-leave-active {
	transition: opacity 200ms;
}
.hero-fade-enter-from,
.hero-fade-leave-to {
	opacity: 0;
}
.actions {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 12px 24px 24px 40px;
	max-width: 560px;
}
/* Buttons in the actions column take full container width */
.actions :deep(.nm-pill) {
	text-align: left;
}
</style>
