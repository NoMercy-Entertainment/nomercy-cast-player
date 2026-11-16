<script setup lang="ts">
import type { Component } from './types';
import { canDraw, registry } from './registry';
import UnknownComponent from './UnknownComponent.vue';

defineProps<{
	component: Component;
}>();
</script>

<script lang="ts">
// Card-shaped server payloads wrap their wrapper under props.data:
//   { id, title, data: { id, title, poster, backdrop, link, ... }, watch }
// Container shapes (carousels, grids, lists) keep the wrapper flat under
// props directly. Normalise by passing props.data when it's an object —
// otherwise the flat props itself.

function normaliseData(props: unknown): any {
	if (
		props &&
		typeof props === 'object' &&
		'data' in props &&
		(props as { data: unknown }).data &&
		typeof (props as { data: unknown }).data === 'object' &&
		!Array.isArray((props as { data: unknown }).data)
	) {
		return (props as { data: unknown }).data;
	}

	return props;
}
</script>

<template>
	<component
		:is="registry[component.component as keyof typeof registry]"
		v-if="canDraw(component.component)"
		:id="component.id"
		:data="normaliseData(component.props)"
		:update="component.update"
	/>
	<UnknownComponent v-else :id="component.id" :type="component.component" />
</template>
