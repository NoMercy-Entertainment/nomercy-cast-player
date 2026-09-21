<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useQuery } from '@tanstack/vue-query';

import type { Component, PluginSlotWrapper } from './types';
import type { CastPluginDescriptor } from '@/lib/plugin/contract';

import Resolver from './Resolver.vue';
import { apiFetch } from '@/lib/http/client';
import { QueryKeys } from '@/queries/keys';
import { queryConfigs } from '@/queries/configs';
import { canSee, visibleEntries } from '@/lib/plugin/access';
import { entriesForSlot, surfaceRefusal } from '@/lib/plugin/slots';
import { PluginSlot } from '@/types/pluginVocabulary';
import { decodePlacements, decodeView, PLUGIN_UI_PATH, viewPath } from '@/lib/plugin/contract';

/**
 * Placed by a screen that wrote the slot itself, or by the server's own
 * payload through the resolver. One component for both so the two cannot come
 * to different answers about what a plugin may draw here.
 */
const props = defineProps<{
	/** One of PluginKind: the area this screen belongs to. */
	kind?: string;
	/** One of PluginSlot: the place within that area. */
	slotName?: string;
	/** The resolver's shape, when the server placed this slot itself. */
	data?: PluginSlotWrapper;
}>();

const kind = computed<string>(() => props.kind ?? props.data?.kind ?? '');
const slotName = computed<string>(() => props.slotName ?? props.data?.slot ?? '');

/**
 * Where every plugin asked to appear, read once for the whole screen.
 *
 * One answer shared by every slot on the wall: fetched per slot, a home page
 * with a music row and a video row asked the same question twice on a device
 * that is the weakest in the ecosystem.
 */
const placements = useQuery({
	queryKey: [...QueryKeys.pluginUi()],
	queryFn: () => apiFetch<unknown>({ path: PLUGIN_UI_PATH, method: 'GET' }).then(decodePlacements),
	...queryConfigs.standard,
});

/** What this account may see, placed here, and drawable on a receiver. */
const placed = computed(() => {
	const all: CastPluginDescriptor[] = placements.data.value ?? [];

	return all
		.filter(plugin => canSee(plugin.access))
		.flatMap(plugin =>
			entriesForSlot(visibleEntries(plugin.entries), kind.value, slotName.value)
				.map(entry => ({ plugin, entry })));
});

/**
 * Said out loud, once per placement the receiver could not draw.
 *
 * An author whose row never appeared had nothing to read and nothing to
 * change, and the same view rendered perfectly in the browser.
 */
const refused = computed(() => {
	const all: CastPluginDescriptor[] = placements.data.value ?? [];

	return all.filter(plugin => canSee(plugin.access)).flatMap(plugin =>
		visibleEntries(plugin.entries)
			.filter(entry => entry.section === kind.value && (entry.slot ?? PluginSlot.Nav) === slotName.value)
			.map(entry => entry.surfaces ?? [])
			.filter(surfaces => surfaces.length > 0 && !surfaces.includes('cast'))
			.map(surfaces => surfaceRefusal(plugin.name, surfaces)));
});

const views = useQuery({
	queryKey: computed(() => [
		...QueryKeys.pluginSlot(kind.value, slotName.value),
		placed.value.map(one => `${one.plugin.id}${one.entry.route}`).join(','),
	]),
	enabled: computed(() => placed.value.length > 0),
	queryFn: async () => {
		return Promise.all(placed.value.map(async ({ plugin, entry }) => ({
			key: `${plugin.id}:${entry.route}`,
			// A plugin whose view fails is one empty row, never an empty wall.
			components: await apiFetch<unknown>({ path: viewPath(plugin.id, entry.route), method: 'GET' })
				.then(decodeView)
				.catch((error: unknown) => {
					console.error(`[plugin] view failed for ${plugin.id} at ${entry.route}:`, error);
					return [] as Component[];
				}),
		})));
	},
	...queryConfigs.standard,
});

const drawn = computed(() => (views.data.value ?? []).filter(one => one.components.length > 0));

// Warned wherever it happens, not inside the view fetch: a slot whose every
// placement was refused fetches nothing at all, and that is the case an author
// most needs to read.
watchEffect(() => {
	for (const refusal of refused.value)
		console.warn(`[plugin] ${refusal.code}: ${refusal.why} ${refusal.fix}`);
});
</script>

<template>
	<!--
		Nothing at all when nothing was placed. An empty heading is a screen
		telling the viewer a feature exists and then not having it.
	-->
	<template v-for="view in drawn" :key="view.key">
		<Resolver
			v-for="component in view.components"
			:key="`${view.key}:${component.id}`"
			:component="component"
		/>
	</template>
</template>
