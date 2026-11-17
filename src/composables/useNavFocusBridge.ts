import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue';
import type { Ref } from 'vue';
import { focusStore } from '@/stores/focusStore';
import type { FocusGroupHandle } from '@/stores/focusStore';

/**
 * Cross-zone focus bridge between the topnav and the active page.
 * Mirrors APK LocalNavbarFocusBridge.kt — without it, pressing
 * ArrowDown on a topnav item or ArrowUp on the topmost rail just
 * returns null and the user is stuck.
 *
 * The page passes either its own FocusGroupHandle (for screens with
 * a single focus group like Profile / Settings) or a container ref
 * (for nested screens like Home / Libraries where the rails wrap
 * NMCarousels which each own their own focus group). When the
 * topnav emits 'cast-receiver:nav-down', the bridge first tries
 * handle.focusFirst(); if that fails it walks the container DOM and
 * focuses the first [data-focusable] element it finds, which lands
 * on the topmost card of the topmost rail.
 */

const TOPNAV_RESTORATION_KEYS = [
	'topnav-mini-player',
	'nav-home',
	'nav-libraries',
	'nav-music',
	'nav-search',
	'nav-profile',
];

interface BridgeArg {
	handle?: FocusGroupHandle;
	containerEl?: Ref<HTMLElement | null>;
}

export function useNavFocusBridge(arg: FocusGroupHandle | BridgeArg): void {
	const handle = 'handleKey' in arg
		? arg
		: arg.handle;
	const containerRef = 'handleKey' in arg
		? null
		: (arg.containerEl ?? null);

	const focusFirstFocusable = (): boolean => {
		const container = containerRef?.value ?? document;
		const el = container.querySelector<HTMLElement>('[data-focusable]:not([disabled])');

		if (el) {
			el.focus();

			return true;
		}

		return false;
	};

	// VideoContentList.kt:87-105: Down from the nav enters the first row on screen, not row 0.
	const focusFirstVisibleRow = (): boolean => {
		const container = containerRef?.value;
		const port = container?.querySelector<HTMLElement>('.nm-hero-rails');
		const rows = Array.from(container?.querySelectorAll<HTMLElement>('.rail-section') ?? []);
		const top = port?.getBoundingClientRect().top ?? 0;
		const row = rows.find((r) => r.getBoundingClientRect().bottom > top);

		if (!row || row === rows[0])
			return false;

		const card = row.querySelector<HTMLElement>('[data-focusable]:not([disabled])');

		card?.focus();

		return Boolean(card);
	};

	const onNavDown = (): void => {
		if (focusFirstVisibleRow()) return;

		// TvRowFocus.kt:60-96: DOWN from the nav lands on the first card fully in view.
		if (handle?.enterFirst?.() || handle?.focusFirst()) return;

		focusFirstFocusable();
	};

	const listen = (): void => window.addEventListener('cast-receiver:nav-down', onNavDown);
	const unlisten = (): void => window.removeEventListener('cast-receiver:nav-down', onNavDown);

	// Only the live page answers: a KeepAlive page set aside stops listening (TvNavigationBar.kt:125-130).
	onMounted(listen);
	onActivated(listen);
	onDeactivated(unlisten);
	onBeforeUnmount(unlisten);
}

// TvNavigationBar.kt:109-131: UP and BACK land on the selected tab, else the first item.
export function focusTopnav(): boolean {
	const selected = document.querySelector<HTMLElement>('.topnav .nav-link.active');

	if (selected) {
		selected.focus();

		return true;
	}

	for (const key of TOPNAV_RESTORATION_KEYS) {
		if (focusStore.requestFocus(key))
			return true;
	}

	return false;
}
