<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { usePlaylistQuery } from '@/queries/usePlaylistQuery';
import { QueryKeys } from '@/queries/keys';
import VideoPlayer from '@/players/video/VideoPlayer.vue';
import Skeleton from '@/components/feedback/Skeleton.vue';
import ErrorPanel from '@/components/feedback/ErrorPanel.vue';

const props = defineProps<{
	type?: string;
	id?: string;
}>();

const route = useRoute();
const type = computed(
	() => (props.type ?? String(route.params.type ?? '')) as 'movie' | 'tv',
);
const id = computed(() => props.id ?? String(route.params.id ?? ''));
const resumeAt = computed(() => {
	const q = route.query.resume_at;
	if (Array.isArray(q))
		return Number(q[0]) || undefined;
	if (typeof q === 'string')
		return Number(q) || undefined;
	return undefined;
});

function queryText(name: string): string | undefined {
	const q = route.query[name];
	const value = Array.isArray(q) ? q[0] : q;
	return typeof value === 'string' && value !== '' ? value : undefined;
}
// The audio and subtitle the handing-off device showed, from the cast intent.
const castAudioLanguage = computed(() => queryText('audio'));
const castSubtitle = computed(() => {
	const language = queryText('subtitle');
	return language
		? { language, type: queryText('subtitleType'), format: queryText('subtitleFormat') }
		: undefined;
});

const { data, isLoading, error, refetch } = usePlaylistQuery(type, id);

const playlist = computed(() => data.value?.playlist ?? []);
const initialItem = computed(() => data.value?.item);

const playerError = ref<string | null>(null);

// On exit, invalidate Home + Libraries so Continue Watching reflects the
// updated playback position the server recorded while we were on this
// screen — mirrors APK WatchScreen.kt onDispose's cache invalidation.
const queryClient = useQueryClient();
onBeforeUnmount(() => {
	void queryClient.invalidateQueries({ queryKey: QueryKeys.home() });
	void queryClient.invalidateQueries({ queryKey: QueryKeys.libraries() });
});
</script>

<template>
	<div class="watch">
		<ErrorPanel
			v-if="error"
			:error="error as Error"
			:retry="() => refetch()"
			context="Couldn't load video"
		/>
		<Skeleton v-else-if="isLoading" type="hero" :count="1" />
		<ErrorPanel
			v-else-if="playerError"
			:error="{ message: playerError }"
			:retry="() => { playerError = null; refetch(); }"
			context="Couldn't play video"
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
			:error="{ message: 'Nothing to play' }"
			:retry="() => refetch()"
			context="Nothing to play"
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
