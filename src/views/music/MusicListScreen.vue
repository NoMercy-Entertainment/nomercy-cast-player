<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFocusGroup } from '@/composables/useFocusGroup';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useMusicListQuery } from '@/queries/useMusicListQuery';
import type { MusicTrack } from '@/queries/useMusicListQuery';
import { buildImageUrl, SQUARE_SIZE } from '@/lib/images/urls';
import { applyThemeColor, clearThemeColor } from '@/lib/theme';
import LoadingIndicator from '@/components/feedback/LoadingIndicator.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';
import { socketStore } from '@/stores/socketStore';
import { playbackStore } from '@/stores/playbackStore';
import { musicSyncBridge } from '@/players/music/syncBridge';

/*
 * Album / playlist detail. Mirrors APK ListScreen.kt's two-column TV
 * layout — left column: cover + title + type + Play button; right
 * column: scrollable track list. Wired to GET /api/v1/music/{type}/{id}.
 */

const route = useRoute();
const router = useRouter();

const type = computed(() => String(route.params.type ?? ''));
const id = computed(() => String(route.params.id ?? ''));

const { data, isLoading, error, refetch } = useMusicListQuery(type, id);

const list = computed(() => data.value ?? null);
const coverUrl = computed(() => buildImageUrl(list.value?.cover ?? null, SQUARE_SIZE));

// APK ListScreen pickPaletteColor(palette.cover ?: image ?: backdrop ?: profile)
// → SetThemeColor for the BigPlayButton + track-row accent.
watch(list, (next) => {
	const palette = next?.color_palette as Record<string, unknown> | undefined;
	const candidate = (palette?.cover ?? palette?.image ?? palette?.backdrop ?? palette?.profile) as
		Parameters<typeof applyThemeColor>[0];
	applyThemeColor(candidate);
}, { immediate: true });
onBeforeUnmount(() => {
	clearThemeColor();
});

const trackCount = computed(() => list.value?.tracks?.length ?? 0);
const totalDurationText = computed(() => {
	const total
		= list.value?.tracks?.reduce((acc, t) => {
			const d = typeof t.duration === 'number' ? t.duration : Number(t.duration ?? 0);
			return acc + (Number.isFinite(d) ? d : 0);
		}, 0) ?? 0;
	if (total <= 0)
		return '';
	const mins = Math.round(total / 60);
	if (mins < 60)
		return `${mins} min`;
	return `${Math.floor(mins / 60)}h ${mins % 60}m`;
});

const containerEl = ref<HTMLElement | null>(null);
useFocusGroup({
	type: 'vertical',
	restorationKey: 'music-list-tracks',
	containerEl,
});

const playEl = ref<HTMLElement | null>(null);
const startError = ref<string | null>(null);

const isCurrentList = computed(() => {
	const current = playbackStore.music.track.value;
	if (!current || !list.value)
		return false;
	return (list.value.tracks ?? []).some(t => t.id === current.id);
});

const playButtonLabel = computed(() => {
	if (isCurrentList.value && playbackStore.music.playing.value)
		return 'Pause';
	if (isCurrentList.value)
		return 'Resume';
	return 'Play';
});

function onPlayClick(): void {
	// APK BigPlayButton: when this list is currently playing, toggle
	// play/pause. Otherwise start the list from the first track.
	if (isCurrentList.value) {
		const engine = musicSyncBridge.current();
		if (engine) {
			if (playbackStore.music.playing.value)
				engine.pause();
			else
				engine.play();
			router.push('/now-playing');
			return;
		}
	}
	const first = list.value?.tracks?.[0];
	if (!first?.id)
		return;
	void startPlayback(first.id).then((started) => {
		if (started)
			router.push('/now-playing');
	});
}

useFocusEntry({
	key: 'music-list-play',
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
			if (playbackStore.music.playing.value)
				engine.pause();
			else
				engine.play();
		}
		router.push('/now-playing');
		return;
	}
	void startPlayback(trackId).then((started) => {
		if (started)
			router.push('/now-playing');
	});
}

async function startPlayback(trackId: string): Promise<boolean> {
	const hub = socketStore.musicHub.value;
	if (!hub || !id.value || !trackId) {
		startError.value = 'Could not start playback. Music is not connected.';
		return false;
	}
	try {
		await hub.invoke('StartPlaybackCommand', type.value, id.value, trackId);
		startError.value = null;
		return true;
	}
	catch {
		startError.value = 'Could not start playback.';
		return false;
	}
}

function formatDuration(d: number | string | undefined): string {
	const seconds = typeof d === 'number' ? d : Number(d ?? 0);
	if (!Number.isFinite(seconds) || seconds <= 0)
		return '';
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function trackArtistText(track: MusicTrack): string {
	return (track.artist_track ?? []).map(a => a.name ?? '').filter(Boolean).join(', ');
}
</script>

<template>
	<LoadingIndicator v-if="isLoading && !list" />
	<ErrorPanel
		v-else-if="error"
		:error="error as Error"
		:retry="() => refetch()"
		context="Couldn't load this list"
	/>
	<section v-else-if="list" ref="containerEl" class="music-list-screen">
		<div class="header-col">
			<div class="cover">
				<img v-if="coverUrl" :src="coverUrl" :alt="list.title ?? ''">
			</div>
			<p class="kind">
				{{ list.type ?? 'Album' }}
			</p>
			<h1 class="title">
				{{ list.title }}
			</h1>
			<p v-if="list.year || trackCount" class="meta">
				<span v-if="list.year">{{ list.year }}</span>
				<span v-if="list.year && trackCount">·</span>
				<span v-if="trackCount">{{ trackCount }} tracks</span>
				<span v-if="totalDurationText">·</span>
				<span v-if="totalDurationText">{{ totalDurationText }}</span>
			</p>
			<button
				ref="playEl"
				class="nm-pill nm-pill-primary"
				type="button"
				data-focusable
				tabindex="0"
				:aria-label="playButtonLabel"
				@click.prevent="onPlayClick"
			>
				<svg
					v-if="isCurrentList && playbackStore.music.playing.value"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<rect x="6" y="4" width="4" height="16" />
					<rect x="14" y="4" width="4" height="16" />
				</svg>
				<svg
					v-else
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="currentColor"
				>
					<path d="M8 5v14l11-7z" />
				</svg>
				{{ playButtonLabel }}
			</button>
			<p v-if="startError" class="start-error">
				{{ startError }}
			</p>
		</div>

		<div class="tracks-col nm-no-scrollbar">
			<header class="tracks-head">
				<span>#</span>
				<span>Title</span>
				<span class="duration">Duration</span>
			</header>
			<ol class="tracks">
				<li
					v-for="(track, index) in list.tracks ?? []"
					:key="track.id ?? index"
					class="track-row"
					:class="[{ 'is-playing': track.id === playbackStore.music.track.value?.id }]"
					data-focusable
					tabindex="0"
					role="button"
					@click="track.id && onTrackClick(track.id)"
					@keydown.enter.prevent="track.id && onTrackClick(track.id)"
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
					<span class="duration">{{ formatDuration(track.duration) }}</span>
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
	color: #fff;
}
.header-col {
	display: flex;
	flex-direction: column;
	gap: 16px;
}
.cover {
	width: 280px;
	aspect-ratio: 1 / 1;
	border-radius: 18px;
	overflow: hidden;
	background: oklch(0.18 0.01 250);
	box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}
.cover img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}
.kind {
	margin: 0;
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: oklch(0.85 0.01 250);
}
.title {
	margin: 0;
	font-size: 32px;
	font-weight: 700;
	line-height: 1.05;
	letter-spacing: -0.01em;
}
.meta {
	margin: 0;
	display: flex;
	gap: 8px;
	font-size: 13px;
	color: oklch(0.85 0.005 250);
}
/* Music list Play button — palette-tinted instead of white */
.header-col :deep(.nm-pill-primary) {
	background: var(--color-primary, oklch(0.7 0.2 285));
	color: #fff;
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
	overflow-y: auto;
}
.tracks-head {
	display: grid;
	grid-template-columns: 32px 1fr auto;
	gap: 16px;
	padding: 0 16px 8px;
	font-size: 11px;
	font-weight: 700;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: oklch(0.7 0.005 250);
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
	grid-template-columns: 32px 1fr auto;
	gap: 16px;
	padding: 10px 16px;
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
	border-color: var(--color-primary, oklch(0.7 0.2 285));
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
.duration {
	color: oklch(0.75 0.005 250);
	font-variant-numeric: tabular-nums;
	font-size: 13px;
	align-self: center;
}
</style>
