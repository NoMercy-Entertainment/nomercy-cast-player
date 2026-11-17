<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useAutoRetry } from '@/composables/useAutoRetry';
import { useMusicListQuery } from '@/queries/useMusicListQuery';
import type { MusicTrack } from '@/queries/useMusicListQuery';
import { buildImageUrl, SQUARE_SIZE } from '@/lib/images/urls';
import { applyThemeColor, clearThemeColor } from '@/lib/theme';
import LoadingIndicator from '@/components/feedback/LoadingIndicator.vue';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import { socketStore } from '@/stores/socketStore';
import { playbackStore } from '@/stores/playbackStore';
import { musicSyncBridge } from '@/players/music/syncBridge';
import { apiFetch } from '@/lib/http/client';
import { updateTrackFavoriteInAllQueries } from '@/lib/queryShim';
import MusicAboutDialog from './MusicAboutDialog.vue';

/*
 * Album / playlist detail. Mirrors APK ListScreen.kt's two-column TV
 * layout — left column: cover + title + type + Play button; right
 * column: scrollable track list. Wired to GET /api/v1/music/{type}/{id}.
 */

const API_PREFIX = /^\/api\/v1\//;
const LEADING_SLASH = /^\//;
const TRAILING_S = /s$/;

const { t } = useTranslation();
const route = useRoute();
const router = useRouter();

const type = computed(() => String(route.params.type ?? ''));
const id = computed(() => String(route.params.id ?? ''));

const { data, isLoading, error, refetch } = useMusicListQuery(type, id);

// A canceled request is not a failure: the page keeps loading or keeps its list.
const shownError = computed(() => {
	const err = error.value as Error | null;

	return err && err.name !== 'AbortError'
		? err
		: null;
});

// Same 15 s self-retry as the other music pages (TvLolomoScreen FAILURE_RETRY_MS).
useAutoRetry({ error: shownError, refetch: () => refetch() });

const list = computed(() => data.value ?? null);
const coverUrl = computed(() => buildImageUrl(list.value?.cover ?? null, SQUARE_SIZE));

// APK ListScreen pickPaletteColor(palette.cover ?: image ?: backdrop ?: profile)
// → SetThemeColor for the BigPlayButton + track-row accent.
watch(list, (next) => {
	const palette = next?.color_palette;
	const candidate = palette?.cover ?? palette?.image ?? palette?.backdrop ?? palette?.profile;

	applyThemeColor(candidate as Parameters<typeof applyThemeColor>[0]);
}, { immediate: true });

onBeforeUnmount(() => {
	clearThemeColor();
});

// ListScreen.kt BigHeaderText: Type (capitalized, no trailing s) • year,
// the year falling back to the first track's album year.
const kindText = computed(() => {
	const type = list.value?.type ?? '';

	return type.charAt(0).toUpperCase() + type.slice(1).replace(TRAILING_S, '');
});
const yearText = computed(() => String(list.value?.year || list.value?.tracks?.[0]?.album_track?.[0]?.year || ''));

const containerEl = ref<HTMLElement | null>(null);
const listGroup = useFocusGroup({
	type: 'vertical',
	restorationKey: 'music-list-tracks',
	initialFocusKey: 'music-list-play',
	containerEl,
});

const playEl = ref<HTMLElement | null>(null);
const startError = ref<string | null>(null);

// BigPlayButton.kt: isCurrentList(link) && currentSong != null, the list the track started from.
const isCurrentList = computed(() => {
	const link = list.value?.link;

	return Boolean(link) &&
		playbackStore.music.listId.value === link &&
		playbackStore.music.track.value !== null;
});

const playButtonLabel = computed(() =>
	isCurrentList.value && playbackStore.music.playing.value
		? t('common.pause')
		: t('common.play'));

const hasTracks = computed(() => (list.value?.tracks?.length ?? 0) > 0);

function onPlayClick(): void {
	// BigPlayButton.kt: toggle when this list is the current one, else play from track 1.
	if (isCurrentList.value) {
		const engine = musicSyncBridge.current();

		if (engine) {
			if (playbackStore.music.playing.value) {
				engine.pause();
			} else {
				engine.play();
			}

			return;
		}
	}

	const first = list.value?.tracks?.[0];

	if (!first?.id) return;

	void startPlayback(first.id);
}

const backEl = ref<HTMLElement | null>(null);
const likeEl = ref<HTMLElement | null>(null);
const aboutEl = ref<HTMLElement | null>(null);
const aboutOpen = ref(false);
// MediaAboutButton.kt shows the info button for a non-blank description only.
const aboutText = computed(() =>
	list.value?.description?.trim()
		? list.value.description
		: '');

// The server's value until the user toggles; ListScreen's MediaLikeButton posts `${link}/like`.
const favoriteOverride = ref<boolean | null>(null);
const isFavorite = computed(() => favoriteOverride.value ?? list.value?.favorite ?? false);

async function onLikeClick(): Promise<void> {
	const link = list.value?.link;

	if (!link) return;

	const before = isFavorite.value;

	favoriteOverride.value = !before;
	updateTrackFavoriteInAllQueries(link, !before);
	const cleanLink = link.replace(API_PREFIX, '').replace(LEADING_SLASH, '');

	try {
		await apiFetch({
			path: `/api/v1/${cleanLink}/like`,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ value: !before }),
		});
	} catch {
		favoriteOverride.value = before;
		updateTrackFavoriteInAllQueries(link, before);
	}
}

// Order -3 to -1 puts the icon buttons before Play (order 0) in the vertical group.
useFocusEntry({
	key: 'music-list-back',
	group: listGroup,
	order: -3,
	el: backEl,
	onAction: () => router.back(),
});

useFocusEntry({
	key: 'music-list-like',
	group: listGroup,
	order: -2,
	el: likeEl,
	onAction: () => void onLikeClick(),
});

useFocusEntry({
	key: 'music-list-about',
	group: listGroup,
	order: -1,
	el: aboutEl,
	onAction: () => {
		aboutOpen.value = true;
	},
});

useFocusEntry({
	key: 'music-list-play',
	group: listGroup,
	el: playEl,
	onAction: onPlayClick,
});

function onTrackClick(trackId: string): void {
	// APK toggles play/pause when clicking the currently-playing track,
	// otherwise starts a new playback session.
	const current = playbackStore.music.track.value;

	if (current?.id === trackId) {
		const engine = musicSyncBridge.current();

		if (engine) {
			if (playbackStore.music.playing.value) {
				engine.pause();
			} else {
				engine.play();
			}
		}

		return;
	}

	void startPlayback(trackId);
}

function trackRowEl(index: number): HTMLElement | null {
	return containerEl.value?.querySelectorAll<HTMLElement>('.track-row')[index] ?? null;
}

// The rows are a v-for in this component, and useFocusEntry binds one entry
// per component, so each row registers in the list group directly.
watch(() => list.value?.tracks ?? [], (tracks, _previous, onCleanup) => {
	const unregister = tracks.map((track, index) => listGroup.register({
		key: `music-list-track-${track.id ?? index}`,
		order: index + 1,
		enabled: true,
		el: () => trackRowEl(index),
		isFocused: () => document.activeElement === trackRowEl(index),
		focus: () => {
			const el = trackRowEl(index);

			el?.focus({ preventScroll: false });

			el?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'center',
			});
		},
		blur: () => trackRowEl(index)?.blur(),
		action: () => {
			if (track.id) {
				onTrackClick(track.id);
			}
		},
	}));

	onCleanup(() => unregister.forEach((off) => off()));
}, { immediate: true });

// The group picks its first focus on mount. A list that loads later has no
// Play button at that time, so focus it once the list is on screen.
watch(list, (next) => {
	if (!next) return;

	void nextTick(() => {
		if (document.activeElement === document.body) {
			listGroup.focusByKey('music-list-play');
		}
	});
});

// MusicPlayerFacade.playTrack: queue the whole list and play on this device first,
// then announce the start to the server (announceStart).
function playLocally(trackId: string): boolean {
	const engine = musicSyncBridge.current();
	const tracks = (list.value?.tracks ?? []).filter((track) => track.id).map((track) => ({
		id: track.id as string,
		path: track.path,
		plugin_id: track.plugin_id,
	}));
	const clicked = tracks.find((track) => track.id === trackId);

	if (!engine?.playTrack || !clicked)
		return false;

	engine.playTrack(clicked, tracks);
	playbackStore.music.applyList(list.value?.link ?? null);

	return true;
}

async function startPlayback(trackId: string): Promise<boolean> {
	const hub = socketStore.musicHub.value;
	const local = playLocally(trackId);

	if (!hub || !id.value || !trackId) {
		startError.value = local
			? null
			: t('views.music.start_error_offline');

		return local;
	}

	try {
		// The server reports a refused start as { ok: false } and does not throw.
		const result = await hub.invoke('StartPlaybackCommand', type.value, id.value, trackId) as { ok?: boolean } | undefined;

		if (result?.ok === false) {
			startError.value = local
				? null
				: t('views.music.start_error');

			return local;
		}

		startError.value = null;

		return true;
	} catch {
		startError.value = local
			? null
			: t('views.music.start_error');

		return local;
	}
}

function trackArtistText(track: MusicTrack): string {
	return (track.artist_track ?? []).map((a) => a.name ?? '').filter(Boolean).join(', ');
}
</script>

<template>
	<LoadingIndicator v-if="(isLoading || (error && !shownError)) && !list" />
	<ErrorPanel
		v-else-if="shownError"
		:error="shownError"
		:retry="() => refetch()"
		:context="t('views.music.list_error')"
	/>
	<section v-else-if="list" ref="containerEl" class="music-list-screen">
		<div class="header-col">
			<div class="cover">
				<img v-if="coverUrl" :src="coverUrl" :alt="list.title ?? ''">
			</div>
			<h1 class="title">
				{{ list.title }}
			</h1>
			<p class="meta">
				<span class="kind">{{ kindText }}</span>
				<span>&bull;</span>
				<span class="year">{{ yearText }}</span>
			</p>
			<div class="music-list-controls">
				<div class="icon-row">
					<button
						ref="backEl"
						class="icon-btn"
						type="button"
						data-focusable
						tabindex="0"
						:aria-label="t('common.back')"
						@click.prevent="router.back()"
					>
						<MoooomIcon icon="chevronLeft" width="28" height="28" />
					</button>
					<button
						v-if="list.link"
						ref="likeEl"
						class="icon-btn"
						type="button"
						data-focusable
						tabindex="0"
						:aria-label="t('views.music.like')"
						:aria-pressed="isFavorite"
						@click.prevent="onLikeClick"
					>
						<MoooomIcon :icon="isFavorite ? 'heartFilled' : 'heart'" width="28" height="28" />
					</button>
					<button
						v-if="aboutText"
						ref="aboutEl"
						class="icon-btn"
						type="button"
						data-focusable
						tabindex="0"
						:aria-label="t('nav.about')"
						@click.prevent="aboutOpen = true"
					>
						<MoooomIcon icon="infoCircle" width="24" height="24" />
					</button>
				</div>
				<button
					ref="playEl"
					class="nm-pill nm-pill-primary"
					type="button"
					data-focusable
					tabindex="0"
					:aria-label="playButtonLabel"
					:disabled="!hasTracks"
					@click.prevent="onPlayClick"
				>
					<MoooomIcon v-if="isCurrentList && playbackStore.music.playing.value" icon="nmPause" width="18" height="18" />
					<MoooomIcon v-else icon="nmPlay" width="18" height="18" />
					{{ playButtonLabel }}
				</button>
			</div>
			<p v-if="startError" class="start-error">
				{{ startError }}
			</p>
			<MusicAboutDialog
				v-if="aboutOpen"
				:name="list.title"
				:description="aboutText"
				@close="aboutOpen = false"
			/>
		</div>

		<div class="tracks-col nm-no-scrollbar">
			<ol class="tracks">
				<!-- eslint-disable-next-line vue-a11y/click-events-have-key-events -- useDPad turns Enter into this click -->
				<li
					v-for="(track, index) in list.tracks ?? []"
					:key="track.id ?? index"
					class="track-row"
					:class="[{ 'is-playing': track.id === playbackStore.music.track.value?.id }]"
					data-focusable
					tabindex="0"
					role="button"
					@click="track.id && onTrackClick(track.id)"
				>
					<span class="track-num">{{ index + 1 }}</span>
					<div class="track-meta">
						<p class="track-title">
							{{ track.title }}
						</p>
						<p v-if="trackArtistText(track)" class="track-artist">
							{{ trackArtistText(track) }}
						</p>
					</div>
				</li>
			</ol>
		</div>
	</section>
</template>

<style scoped>
.music-list-screen {
	display: grid;
	grid-template-columns: 1fr 2fr;
	gap: 32px;
	padding: 72px 32px 32px;
	height: 100%;
	color: var(--cast-text-primary);
}
.header-col {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.cover {
	width: calc(100% - 60px);
	aspect-ratio: 1 / 1;
	border-radius: 12px;
	overflow: hidden;
	background: oklch(0.18 0.01 250);
	box-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
}
.cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.title {
	margin: 0;
	font-size: 28px;
	font-weight: 800;
	line-height: 1.05;
	letter-spacing: -0.01em;
}
.meta {
	margin: 0;
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 14px;
	color: oklch(0.85 0.005 250);
}
.kind {
	font-size: 16px;
}
.music-list-controls {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-right: 52px;
}
.icon-row {
	display: flex;
	align-items: center;
}
.icon-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 48px;
	height: 48px;
	padding: 0;
	border: 2px solid transparent;
	border-radius: 50%;
	background: transparent;
	color: var(--cast-text-primary);
	outline: none;
	cursor: pointer;
}
.icon-btn:focus-visible {
	border-color: var(--cast-white);
	background: rgba(255, 255, 255, 0.08);
}
/* Music list Play button — palette-tinted instead of white */
.header-col :deep(.nm-pill-primary) {
	background: var(--color-primary, oklch(0.7 0.2 285));
	color: var(--cast-text-primary);
}
.header-col :deep(.nm-pill-primary):focus-visible,
.header-col :deep(.nm-pill-primary):hover {
	background: var(--color-primary, oklch(0.7 0.2 285));
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}
.start-error {
	margin: 0;
	font-size: 13px;
	color: oklch(0.75 0.15 25);
}
.tracks-col {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding-top: 16px;
	overflow-y: auto;
}
.tracks {
	list-style: none;
	margin: 8px 0 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 2px;
}
.track-row {
	display: grid;
	grid-template-columns: 32px 1fr;
	gap: 16px;
	padding: 8px 12px 8px 16px;
	min-height: 48px;
	border-radius: 8px;
	cursor: pointer;
	transition:
		background var(--motion-fast),
		border var(--motion-fast);
	outline: none;
	border: 2px solid transparent;
}
.track-row:focus-visible {
	background: rgba(255, 255, 255, 0.05);
	border-color: var(--cast-white);
}
.track-row.is-playing .track-num {
	color: var(--color-primary, oklch(0.7 0.2 285));
}
.track-row.is-playing .track-title {
	color: var(--color-primary, oklch(0.7 0.2 285));
}
.track-num {
	color: oklch(0.7 0.005 250);
	font-variant-numeric: tabular-nums;
	font-size: 14px;
	align-self: center;
}
.track-meta {
	min-width: 0;
}
.track-title {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.track-artist {
	margin: 2px 0 0;
	font-size: 12px;
	color: oklch(0.75 0.005 250);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>
