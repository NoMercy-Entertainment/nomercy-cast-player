// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

type StyledElement = HTMLElement | SVGElement;

interface SavedProperty {
	value: string;
	priority: string;
	applied: string;
}

interface LayoutElement {
	element: StyledElement;
	properties: Map<string, SavedProperty>;
}

type ItemFor = (element: StyledElement) => LayoutElement;

const GAP_SIDES = {
	row: ['right', 'left'],
	'row-reverse': ['left', 'right'],
	column: ['bottom', 'top'],
	'column-reverse': ['top', 'bottom'],
} as const;

function styled(element: Element): element is StyledElement {
	return element instanceof HTMLElement || element instanceof SVGElement;
}

function nativeFlexGap(): boolean {
	const probe = document.createElement('div');

	probe.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';
	probe.append(document.createElement('div'), document.createElement('div'));
	document.body.append(probe);
	const supported = probe.scrollHeight === 1;

	probe.remove();

	return supported;
}

function ratioOf(value: string): number {
	const [width, height = '1'] = value.trim().split('/');
	const ratio = Number(width) / Number(height);

	return Number.isFinite(ratio) && ratio > 0
		? ratio
		: 0;
}

function restore(item: LayoutElement): void {
	for (const [property, saved] of item.properties) {
		if (item.element.style.getPropertyValue(property) !== saved.applied) continue;

		if (saved.value) {
			item.element.style.setProperty(property, saved.value, saved.priority);
		} else {
			item.element.style.removeProperty(property);
		}
	}

	item.properties.clear();
}

function setProperty(item: LayoutElement, property: string, value: string): void {
	const style = item.element.style;

	item.properties.set(property, {
		value: style.getPropertyValue(property),
		priority: style.getPropertyPriority(property),
		applied: value,
	});

	style.setProperty(property, value);
	const saved = item.properties.get(property);

	if (saved) {
		saved.applied = style.getPropertyValue(property);
	}
}

function dimensionOf(element: StyledElement, style: CSSStyleDeclaration, name: string): string {
	return element.style.getPropertyValue(name) || style.getPropertyValue(`--cast-css-${name}`).trim();
}

function columnBasisHeight(element: StyledElement, style: CSSStyleDeclaration): boolean {
	const parent = element.parentElement;

	if (!parent || style.flexBasis === 'auto' || style.flexBasis === 'content')
		return false;

	const parentStyle = getComputedStyle(parent);

	return ['flex', 'inline-flex'].includes(parentStyle.display) &&
		parentStyle.flexDirection.startsWith('column');
}

function applyRatio(item: LayoutElement, style: CSSStyleDeclaration): void {
	const ratio = ratioOf(style.getPropertyValue('--cast-aspect-ratio'));

	if (!ratio || style.display === 'none') return;

	const width = dimensionOf(item.element, style, 'width');
	const height = dimensionOf(item.element, style, 'height');
	const fixedWidth = Boolean(width && width !== 'auto');
	const fixedHeight = Boolean(height && height !== 'auto') ||
		(!fixedWidth && columnBasisHeight(item.element, style));

	if (fixedHeight && fixedWidth) return;

	const axis = fixedHeight
		? 'width'
		: 'height';
	// Computed dimensions are untransformed; focus scaling must not feed back into card sizing.
	const size = fixedHeight
		? Number.parseFloat(style.height) * ratio
		: Number.parseFloat(style.width) / ratio;

	if (size > 0) {
		setProperty(item, axis, `${size}px`);
	}
}

function visibleChild(element: Element): element is StyledElement {
	if (!styled(element))
		return false;

	const style = getComputedStyle(element);

	return style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed';
}

function autoMargin(element: StyledElement, side: string): boolean {
	const property = `margin-${side}`;

	return element.style.getPropertyValue(property) === 'auto' ||
		getComputedStyle(element).getPropertyValue(`--cast-${property}`).trim() === 'auto';
}

function sidesFor(direction: string): readonly [string, string] {
	switch (direction) {
		case 'column': return GAP_SIDES.column;
		case 'column-reverse': return GAP_SIDES['column-reverse'];
		case 'row-reverse': return GAP_SIDES['row-reverse'];
		default: return GAP_SIDES.row;
	}
}

function compareOrder(first: StyledElement, second: StyledElement): number {
	return Number(getComputedStyle(first).order) - Number(getComputedStyle(second).order);
}

function applyGap(element: StyledElement, itemFor: ItemFor): void {
	const style = getComputedStyle(element);

	if (!['flex', 'inline-flex'].includes(style.display)) return;

	const direction = style.flexDirection;
	const vertical = direction.startsWith('column');
	const gap = vertical
		? style.rowGap
		: style.columnGap;

	if (!gap || gap === 'normal' || Number.parseFloat(gap) === 0) return;

	const children = [...element.children].filter(visibleChild).sort(compareOrder);
	const sides = sidesFor(direction);
	const reversed = !vertical && style.direction === 'rtl';
	const [trailing, leading] = reversed
		? [sides[1], sides[0]]
		: sides;

	children.slice(1).forEach((child, index) => {
		const previous = children[index];

		if (!previous) return;

		const useLeading = autoMargin(previous, trailing);
		const target = useLeading
			? child
			: previous;
		const side = useLeading
			? leading
			: trailing;
		const property = `margin-${side}`;
		const margin = getComputedStyle(target).getPropertyValue(property);

		setProperty(itemFor(target), property, `calc(${margin} + ${gap})`);
	});
}

/** Layout fallback for the receiver's non-wrapping flex and width-driven card layouts. */
export function installCastLayout(): () => void {
	const gapNeeded = !nativeFlexGap();
	const ratioNeeded = !CSS.supports('aspect-ratio', '1');

	if (!gapNeeded && !ratioNeeded)
		return () => {};

	const items = new Map<StyledElement, LayoutElement>();
	const candidates = new Set<Element>();
	let frame = 0;
	let stopped = false;

	const itemFor = (element: StyledElement): LayoutElement => {
		const current = items.get(element);

		if (current)
			return current;

		const item = { element, properties: new Map<string, SavedProperty>() };

		items.set(element, item);

		return item;
	};

	const collect = (element: Element): void => {
		candidates.add(element);

		for (const child of element.querySelectorAll('*')) {
			candidates.add(child);
		}
	};

	const schedule = (): void => {
		if (!frame && !stopped) {
			frame = requestAnimationFrame(update);
		}
	};

	const resize = new ResizeObserver((entries) => {
		for (const entry of entries) {
			candidates.add(entry.target);
		}

		schedule();
	});
	const mutations = new MutationObserver((entries) => {
		for (const entry of entries) {
			if (entry.target instanceof Element) {
				collect(entry.target);
			}
		}

		schedule();
	});

	const observe = (): void => {
		mutations.observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['class', 'style', 'hidden'],
		});
	};

	function update(): void {
		frame = 0;
		mutations.disconnect();

		for (const [element, item] of items) {
			restore(item);

			if (!element.isConnected) {
				resize.unobserve(element);
				items.delete(element);
			}
		}

		for (const element of candidates) {
			if (!element.isConnected || !styled(element)) continue;

			const style = getComputedStyle(element);
			const ratio = ratioNeeded && ratioOf(style.getPropertyValue('--cast-aspect-ratio'));
			const flex = gapNeeded && ['flex', 'inline-flex'].includes(style.display);

			if (ratio || flex) {
				itemFor(element);
				resize.observe(element);
			}
		}

		candidates.clear();

		for (const item of items.values()) {
			if (ratioNeeded) {
				applyRatio(item, getComputedStyle(item.element));
			}
		}

		if (gapNeeded) {
			for (const item of [...items.values()]) {
				applyGap(item.element, itemFor);
			}
		}

		observe();
	}

	const stylesheetLoaded = (event: Event): void => {
		if (event.target instanceof HTMLLinkElement) {
			collect(document.body);
			schedule();
		}
	};

	collect(document.body);
	update();
	document.addEventListener('load', stylesheetLoaded, true);

	return () => {
		stopped = true;
		cancelAnimationFrame(frame);
		resize.disconnect();
		mutations.disconnect();
		document.removeEventListener('load', stylesheetLoaded, true);

		for (const item of items.values()) {
			restore(item);
		}
	};
}
