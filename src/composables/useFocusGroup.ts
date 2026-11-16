import { getCurrentInstance, inject, onActivated, onBeforeUnmount, onDeactivated, onMounted, provide, ref, toRaw, watch } from 'vue';
import type { Ref } from 'vue';
import {
	focusStore,

} from '@/stores/focusStore';
import type { Direction, FocusGroupHandle, FocusGroupType } from '@/stores/focusStore';
import { FocusGroupInjectionKey } from './useFocusEntry';
import type { FocusEntry, FocusGroupRegistry } from './useFocusEntry';

export interface FocusGroupOptions {
	type: FocusGroupType;
	/** Stable key for per-route restoration memory. */
	restorationKey?: string;
	/** Which child to focus first on mount, before restoration falls back. */
	initialFocusKey?: string;
	/** For 'grid' type — column count. */
	columns?: number;
	/** Called when focus tries to leave; return true to mark handled. */
	onEscape?: (dir: Direction) => boolean;
	/** Container element for scroll-into-view bookkeeping. */
	containerEl?: Ref<HTMLElement | null>;
	/** Don't auto-focus the first child on mount. */
	autoFocus?: boolean;
}

/**
 * Focus group composable. Provides FocusGroupRegistry to nested
 * useFocusEntry calls, registers itself on the focusStore stack, and
 * (when a parent exists) registers itself as a proxy entry in the
 * parent group so cross-group navigation (rails ↔ rails on home,
 * actions ↔ rails on info, etc.) routes through the parent's
 * pickNeighbor naturally.
 */
export function useFocusGroup(opts: FocusGroupOptions): FocusGroupHandle & FocusGroupRegistry {
	const entries = ref<FocusEntry[]>([]);
	const parent = inject(FocusGroupInjectionKey, null);

	function sortedEnabled(): FocusEntry[] {
		return [...entries.value]
			.sort((a, b) => a.order - b.order)
			.filter((e) => e.enabled !== false);
	}

	function pickNeighbor(current: FocusEntry, dir: Direction): FocusEntry | null {
		const list = sortedEnabled();
		const idx = list.indexOf(current);

		if (idx === -1)
			return null;

		switch (opts.type) {
			case 'horizontal':
				if (dir === 'left')
					return list[idx - 1] ?? null;

				if (dir === 'right')
					return list[idx + 1] ?? null;

				return null;
			case 'vertical':
				if (dir === 'up')
					return list[idx - 1] ?? null;

				if (dir === 'down')
					return list[idx + 1] ?? null;

				return null;

			case 'grid': {
				const cols = Math.max(1, opts.columns ?? 1);

				if (dir === 'left')
					return list[idx - 1] ?? null;

				if (dir === 'right')
					return list[idx + 1] ?? null;

				if (dir === 'up')
					return list[idx - cols] ?? null;

				if (dir === 'down')
					return list[idx + cols] ?? null;

				return null;
			}

			case 'modal':

			case 'free': {
				const currentEl = current.el();

				if (!currentEl)
					return null;

				const cur = currentEl.getBoundingClientRect();
				const cx = cur.left + cur.width / 2;
				const cy = cur.top + cur.height / 2;

				let best: FocusEntry | null = null;
				let bestScore = Infinity;

				for (const e of list) {
					if (e === current) continue;

					const el = e.el();

					if (!el) continue;

					const r = el.getBoundingClientRect();
					const ex = r.left + r.width / 2;
					const ey = r.top + r.height / 2;
					const dx = ex - cx;
					const dy = ey - cy;
					const inDir =
						(dir === 'up' && dy < -1) ||
						(dir === 'down' && dy > 1) ||
						(dir === 'left' && dx < -1) ||
						(dir === 'right' && dx > 1);

					if (!inDir) continue;

					const along = dir === 'up' || dir === 'down'
						? Math.abs(dy)
						: Math.abs(dx);
					const perp = dir === 'up' || dir === 'down'
						? Math.abs(dx)
						: Math.abs(dy);
					const score = along + perp * 2;

					if (score < bestScore) {
						bestScore = score;
						best = e;
					}
				}

				return best;
			}
		}
	}

	const handle: FocusGroupHandle & FocusGroupRegistry = {
		type: opts.type,
		register(entry) {
			entries.value.push(entry);
			focusStore.entryChanges.value++;

			return () => {
				// The ref hands back reactive proxies, so compare the raw objects.
				entries.value = entries.value.filter((e) => toRaw(e) !== entry);
			};
		},
		focusByKey(key) {
			const e = entries.value.find((x) => x.key === key && x.enabled !== false);

			if (!e)
				return false;

			e.focus();

			return true;
		},
		focusFirst() {
			const list = sortedEnabled();
			const e = list[0];

			if (!e)
				return false;

			e.focus();

			return true;
		},
		focusLast() {
			const list = sortedEnabled();
			const e = list[list.length - 1];

			if (!e)
				return false;

			e.focus();

			return true;
		},
		hasEntry(key) {
			return entries.value.some((e) => e.key === key);
		},
		containsFocused() {
			return entries.value.some((e) => e.isFocused());
		},
		ownsFocused() {
			return entries.value.some((e) => !e.key.startsWith('group:') && e.isFocused());
		},
		handleKey(dir) {
			const current = entries.value.find((e) => e.isFocused());

			if (!current) {
				// Focus is outside this group's direct entries — defer to
				// parent so cross-group navigation walks up the tree
				// instead of stealing focus to our first entry.
				if (opts.onEscape?.(dir))
					return true;

				return parent?.handleKey(dir) ?? false;
			}

			const target = pickNeighbor(current, dir);

			if (target) {
				(target.enter ?? target.focus)();

				return true;
			}

			if (opts.type === 'modal')
				return true;

			if (opts.onEscape?.(dir))
				return true;

			return parent?.handleKey(dir) ?? false;
		},
		dispatchEscape() {
			return opts.onEscape?.('back') ?? false;
		},
	};

	provide(FocusGroupInjectionKey, handle);

	let parentUnregister: (() => void) | undefined;
	let isActive = false;
	const proxyKey = `group:${opts.restorationKey ?? Math.random().toString(36).slice(2, 10)}`;

	function buildProxyEntry(): FocusEntry {
		return {
			key: proxyKey,
			order: 0,
			enabled: true,
			el: () => opts.containerEl?.value ?? null,
			isFocused: () => handle.containsFocused(),
			focus: () => {
				if (opts.restorationKey) {
					const restored = focusStore.consumeRestoration(opts.restorationKey);

					if (restored && handle.focusByKey(restored)) return;
				}

				handle.focusFirst();
			},
			// TvRowFocus.focusFirstFocusableInRow: a row change lands on the first card fully in view.
			enter: opts.type === 'horizontal'
				? focusFirstVisible
				: undefined,
			blur: () => {},
			action: () => {},
		};
	}

	function focusFirstVisible(): void {
		const view = opts.containerEl?.value?.getBoundingClientRect();
		const target = sortedEnabled().find((e) => {
			const box = e.el()?.getBoundingClientRect();

			return !!box && !!view && box.left >= view.left && box.right <= view.right;
		});

		if (target) {
			target.focus();
		} else {
			handle.focusFirst();
		}
	}

	function activate(): void {
		if (isActive) return;

		isActive = true;
		focusStore.pushGroup(handle);
		document.addEventListener('focusin', trackFocus);

		// Register self as a focusable proxy in the parent group so the
		// parent's pickNeighbor can navigate between sibling groups
		// (e.g. rails ↔ rails on home, action col ↔ poster col on info).
		if (parent) {
			parentUnregister = parent.register(buildProxyEntry());
		}
	}

	function deactivate(keepAliveLeave = false): void {
		if (!isActive) return;

		isActive = false;
		document.removeEventListener('focusin', trackFocus);
		saveRestoration(keepAliveLeave);
		parentUnregister?.();
		parentUnregister = undefined;
		focusStore.popGroup(handle);
	}

	function focusableActiveElement(): boolean {
		const el = document.activeElement as HTMLElement | null;

		if (!el || el === document.body)
			return false;

		// Treat any [data-focusable] or natively-focusable form element as
		// owning focus for auto-focus arbitration purposes.
		return el.matches('[data-focusable], button, a[href], input, textarea, select, [tabindex="0"]');
	}

	function attemptAutoFocus(): void {
		if (opts.autoFocus === false) return;

		// Defer to a microtask so deepest-first onMounted siblings (e.g.
		// child carousel groups) can register before we decide who wins.
		// First group whose microtask runs and finds nothing focused wins;
		// later siblings short-circuit on the focusableActiveElement guard.
		queueMicrotask(() => {
			if (focusableActiveElement()) return;

			if (parent && parent.containsFocused()) return;

			if (opts.restorationKey) {
				const restored = focusStore.consumeRestoration(opts.restorationKey);

				if (restored && handle.focusByKey(restored)) return;
			}

			if (opts.initialFocusKey && handle.focusByKey(opts.initialFocusKey)) return;

			// Top-level page groups (no parent) always fall through to first.
			// Nested groups skip the fallback so the parent's proxy walk wins
			// — if the parent group decides this is the active sub-group,
			// it'll call this group's focusFirst via the proxy entry below.
			if (!parent) {
				focusStore.autoFocus(() => handle.focusFirst());
			}
		});
	}

	// KMP keeps the position of the card that last held focus (TvCardViewHolder.kt:279-287).
	// A KeepAlive leave saves it even though focus is already gone; an unmount keeps the old rule.
	let lastFocusedKey: string | null = null;

	function trackFocus(): void {
		const focused = entries.value.find((e) => e.isFocused());

		if (focused) {
			lastFocusedKey = focused.key;
		}
	}

	function saveRestoration(keepAliveLeave: boolean): void {
		if (!opts.restorationKey) return;

		const focused = entries.value.find((e) => e.isFocused()) ??
			(keepAliveLeave
				? entries.value.find((e) => e.key === lastFocusedKey)
				: undefined);

		if (focused) {
			focusStore.saveRestoration(opts.restorationKey, focused.key);
		}
	}

	onMounted(() => {
		activate();
		attemptAutoFocus();
	});

	// A server-driven page mounts before its data (or on an error panel); its cards register later.
	if (!parent) {
		watch(focusStore.entryChanges, () => {
			if (isActive) {
				attemptAutoFocus();
			}
		});
	}

	// KeepAlive cycle: re-enter restored page → reattach to focusStore stack
	// and re-attempt auto-focus so the saved entry regains focus. Without
	// this, going back from /info to / leaves focus on document.body and
	// D-pad presses do nothing until the user clicks something.
	//
	// The activate/deactivate guard prevents double-pushing: onActivated
	// fires after onMounted on first mount, and we don't want two stack
	// entries / two proxy registrations for the same group.
	if (getCurrentInstance()) {
		onActivated(() => {
			activate();
			attemptAutoFocus();
		});

		onDeactivated(() => {
			deactivate(true);
		});
	}

	onBeforeUnmount(() => {
		deactivate();
	});

	return handle;
}
