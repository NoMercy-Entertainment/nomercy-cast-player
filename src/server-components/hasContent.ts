import { canDraw } from './registry';
import type { Component, ComponentData } from './types';

const LISTS = new Set(['NMCarousel', 'NMGrid', 'NMList', 'NMContainer', 'NMLolomo']);

// HasContent.kt:10-17 and NMComponents.kt:53-62: an empty list, a home card without
// data and a component the receiver cannot draw have nothing to show.
export function hasContent(component: Component): boolean {
	if (!canDraw(component.component))
		return false;

	const props = component.props as { items?: Component[]; data?: ComponentData };

	if (LISTS.has(component.component))
		return Array.isArray(props.items) && props.items.length > 0;

	if (component.component === 'NMHomeCard')
		return props.data != null;

	return true;
}
