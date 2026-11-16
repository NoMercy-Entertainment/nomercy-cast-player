<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { LocationQueryValue } from 'vue-router';
import { useTranslation } from 'i18next-vue';
import { usePlaylistQuery } from '@/queries/usePlaylistQuery';
import { invalidateAfterPlayback } from '@/lib/queryShim';
import { playbackStore } from '@/stores/playbackStore';
import VideoPlayer from '@/players/video/VideoPlayer.vue';
import Skeleton from '@/components/feedback/Skeleton.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';

type QueryValue = LocationQueryValue | LocationQueryValue[] | undefined;

const props = defineProps<{
	type?: string;
	id?: string;
}>();

const { t } = useTranslation();
const route = useRoute();
const type = computed(
	() => (props.type ?? String(route.params.type ?? '')) as 'movie' | 'tv',
);
const id = computed(() => props.id ?? String(route.params.id ?? ''));
const resumeAt = computed(() => {
	const first = (value: QueryValue) => Number(Array.isArray(value)
		? value[0]
		: value);
	const seconds = first(route.query.resume_at);

	if (Number.isFinite(seconds) && seconds > 0)
		return seconds;

	// The phone's route carries `position` in milliseconds (app-kmp PhoneCastSenderImpl.kt castRoute positionMs).
	const milliseconds = first(route.query.position);

	return Number.isFinite(milliseconds) && milliseconds > 0
		? milliseconds / 1000
		: undefined;
});

function queryText(name: string): string | undefined {
	const q = route.query[name];
	const value = Array.isArray(q)
		? q[0]
		: q;

	return typeof value === 'string' && value !== ''
		? value
		: undefined;
}

// The audio and subtitle the handing-off device showed, from the cast intent.
const castAudioLanguage = computed(() => queryText('audio'));
const castSubtitle = computed(() => {
	const language = queryText('subtitle');

	return language
		? {
				language,
				type: queryText('subtitleType'),
				format: queryText('subtitleFormat'),
			}
		: undefined;
});

const { data, isLoading, error, refetch } = usePlaylistQuery(type, id);

const playlist = computed(() => data.value?.playlist ?? []);
const initialItem = computed(() => {
	const season = Number(queryText('season'));
	const episode = Number(queryText('episode'));

	if (
		type.value === 'tv' && Number.isInteger(season) && Number.isInteger(episode) &&
		season >= 0 && episode > 0
	) {
		return playlist.value.find(
			(item) => Number(item.season) === season && Number(item.episode) === episode,
		) ?? data.value?.item;
	}

	return data.value?.item;
});

const playerError = ref<string | null>(null);

// On exit, invalidate Home + Libraries so Continue Watching reflects the
// updated playback position the server recorded while we were on this
// screen — mirrors APK WatchScreen.kt onDispose's cache invalidation.
onBeforeUnmount(() => invalidateAfterPlayback(playbackStore.video.timeMs.value > 0));
</script>

<template>
	<div class="watch">
		<ErrorPanel
			v-if="error"
			:error="error as Error"
			:retry="() => refetch()"
			:context="t('views.watch.load_error')"
		/>
		<Skeleton v-else-if="isLoading" type="hero" :count="1" />
		<ErrorPanel
			v-else-if="playerError"
			:error="{ message: playerError }"
			:retry="() => { playerError = null; refetch(); }"
			:context="t('views.watch.play_error')"
		/>
		<VideoPlayer
			v-else-if="initialItem"
			:id="id"
			:type="type"
			:resume-at="resumeAt"
			:cast-audio-language="castAudioLanguage"
			:cast-subtitle="castSubtitle"
			:playlist="playlist"
			:initial-item="initialItem"
			@error="(message) => { playerError = message; }"
		/>
		<ErrorPanel
			v-else
			:error="{ message: t('views.watch.nothing_to_play') }"
			:retry="() => refetch()"
			:context="t('views.watch.nothing_to_play')"
		/>
	</div>
</template>

<style scoped>
.watch {
	position: fixed;
	inset: 0;
	background: black;
	z-index: 100;
}
</style>
