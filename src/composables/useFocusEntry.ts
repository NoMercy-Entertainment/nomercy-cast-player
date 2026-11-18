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
	/** How a move from another entry arrives, when that differs from focus() (a rail picks its first visible card). */
	enter?: () => void;
	blur: () => void;
	action: () => void;
}

export interface FocusEntryOptions {
	key: string;
	/** Group to register in. Needed when the component creates its own group, because inject only sees a parent's. */
	group?: FocusGroupRegistry;
	order?: number;
	/** The entry is the title of its row (the season chip): focus puts that row's top at the list top. */
	alignRow?: boolean;
	enabled?: Ref<boolean>;
	el: Ref<HTMLElement | null>;
	onFocus?: () => void;
	onBlur?: () => void;
	onAction?: () => void;
}

export interface FocusGroupRegistry {
	type?: FocusGroupHandle['type'];
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

			if (!el) return;

			const scroll = !focusStore.isAutoFocus();

			// The browser's own focus scroll lands a card at the list edge and fights the row align below.
			el.focus({ preventScroll: true });

			if (scroll) {
				const behavior = focusStore.isRestoringFocus()
					? 'instant'
					: 'smooth';
				// RowTopAlignLayoutManager: a row's top, title included, sits at the list's top padding.
				const rowSelector = group?.type === 'horizontal'
					? '.nm-hero-rails > .rail-section'
					: opts.alignRow && '.info-list > .info-seasons';
				const row = rowSelector
					? el.closest<HTMLElement>(rowSelector)
					: null;
				const port = row?.parentElement;
				// Chrome 92 (the TV) ignores scroll-margin and scroll-padding here, so the list top is set by hand.
				const rowTop = row && port
					? port.scrollTop + row.getBoundingClientRect().top - port.getBoundingClientRect().top -
					(Number.parseFloat(getComputedStyle(port).scrollPaddingTop) || 0)
					: null;

				const track = row && group?.type === 'horizontal'
					? el.closest<HTMLElement>('.rail-track')
					: null;

				// A rail card scrolls its track and the list by hand: scrollIntoView's block 'nearest'
				// also scrolled the list on the TV and won over the list scroll.
				if (track) {
					const pad = Number.parseFloat(getComputedStyle(track).paddingLeft) || 0;
					const left = track.scrollLeft + el.getBoundingClientRect().left -
						track.getBoundingClientRect().left - pad;

					if (typeof track.scrollTo === 'function') {
						track.scrollTo({ left: Math.max(0, left), behavior });
					} else {
						track.scrollLeft = Math.max(0, left);
					}
				} else if (!row) {
					el.scrollIntoView({
						behavior,
						block: 'nearest',
						inline: group?.type === 'horizontal'
							? 'start'
							: 'center',
					});
				}

				// Chrome 92 stops one smooth scroll when another starts, so a move along the row leaves the list alone.
				if (port && rowTop !== null && Math.abs(Math.max(0, rowTop) - port.scrollTop) >= 1) {
					port.scrollTo({ top: Math.max(0, rowTop), behavior });
				}
			}

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
			el.addEventListener('focus', () =>
				opts.onFocus?.());

			el.addEventListener('blur', () =>
				opts.onBlur?.());

			// Enter on a focusable triggers the action handler. Browser fires
			// 'click' for natively-focusable elements; custom divs need this.
			if (opts.onAction) {
				unregisterAction = focusStore.registerAction(el, opts.onAction);
			}

			el.addEventListener('keydown', (event) => {
				// useDPad already ran this key (the action or a click) and prevented it.
				if (event.defaultPrevented) return;

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
