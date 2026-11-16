import { inject, onBeforeUnmount, onMounted } from 'vue';
import type { InjectionKey, Ref } from 'vue';
import { focusStore } from '@/stores/focusStore';
import type { FocusGroupHandle } from '@/stores/focusStore';

export interface FocusEntry {
	key: string;
	order: number;
	enabled: boolean;
	el: () => HTMLElement | null;
	isFocused: () => boolean;
	focus: () => void;
	blur: () => void;
	action: () => void;
}

export interface FocusEntryOptions {
	key: string;
	/** Group to register in. Needed when the component creates its own group, because inject only sees a parent's. */
	group?: FocusGroupRegistry;
	order?: number;
	enabled?: Ref<boolean>;
	el: Ref<HTMLElement | null>;
	onFocus?: () => void;
	onBlur?: () => void;
	onAction?: () => void;
}

export interface FocusGroupRegistry {
	register: (entry: FocusEntry) => () => void;
}

export const FocusGroupInjectionKey: InjectionKey<FocusGroupHandle & FocusGroupRegistry> = Symbol(
	'FocusGroupRegistry',
);

/**
 * Bind a DOM element as a focusable entry within the nearest FocusGroup.
 * Auto-registers on mount, auto-unregisters on unmount.
 *
 * The element should carry [data-focusable] and tabindex=0 (or be a
 * natively-focusable element like button/input). Browser-native focus +
 * outline drive the visible ring; our store only orchestrates traversal.
 */
export function useFocusEntry(opts: FocusEntryOptions): FocusEntry {
	const group = opts.group ?? inject(FocusGroupInjectionKey, null);

	const entry: FocusEntry = {
		key: opts.key,
		order: opts.order ?? 0,
		get enabled() {
			// An entry whose element is not drawn (a Show All pill with no link) is no neighbor.
			return (opts.enabled?.value ?? true) && opts.el.value !== null;
		},
		el: () => opts.el.value,
		isFocused: () => document.activeElement === opts.el.value,
		focus: () => {
			const el = opts.el.value;
			if (!el)
				return;
			el.focus({ preventScroll: false });
			el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
			opts.onFocus?.();
		},
		blur: () => {
			opts.el.value?.blur();
			opts.onBlur?.();
		},
		action: () => opts.onAction?.(),
	};

	let unregister: (() => void) | undefined;
	let unregisterAction: (() => void) | undefined;

	onMounted(() => {
		if (!group) {
			console.warn(`[focus] useFocusEntry("${opts.key}") used outside FocusGroup`);
			return;
		}
		unregister = group.register(entry);
		// Wire native focus/blur events so the entry's onFocus/onBlur callbacks
		// fire whether the focus came from D-pad traversal or from a stray
		// mouse interaction during dev/QA.
		const el = opts.el.value;
		if (el) {
			el.addEventListener('focus', () => opts.onFocus?.());
			el.addEventListener('blur', () => opts.onBlur?.());
			// Enter on a focusable triggers the action handler. Browser fires
			// 'click' for natively-focusable elements; custom divs need this.
			if (opts.onAction)
				unregisterAction = focusStore.registerAction(el, opts.onAction);
			el.addEventListener('keydown', (event) => {
				// useDPad already ran this key (the action or a click) and prevented it.
				if (event.defaultPrevented)
					return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					opts.onAction?.();
				}
			});
		}
	});

	onBeforeUnmount(() => {
		unregisterAction?.();
		unregister?.();
	});

	return entry;
}
