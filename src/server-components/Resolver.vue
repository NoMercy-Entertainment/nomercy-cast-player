<script setup lang="ts">
import type { Component, ComponentData, WrappedData } from './types';
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
// props directly. Normalize by passing props.data when it's an object —
// otherwise the flat props itself.

function isWrapped(props: ComponentData | WrappedData): props is WrappedData {
	return 'data' in props &&
		Boolean(props.data) &&
		typeof props.data === 'object' &&
		!Array.isArray(props.data);
}

function normalizeData(props: ComponentData | WrappedData): ComponentData {
	return isWrapped(props)
		? props.data
		: props;
}
</script>

<template>
	<component
		:is="registry[component.component as keyof typeof registry]"
		v-if="canDraw(component.component)"
		:id="component.id"
		:data="normalizeData(component.props)"
		:update="component.update"
	/>
	<UnknownComponent v-else :id="component.id" :type="component.component" />
</template>
