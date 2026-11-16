import { onBeforeUnmount, onMounted } from 'vue';
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

	const onNavDown = (): void => {
		if (handle?.focusFirst()) return;

		focusFirstFocusable();
	};

	onMounted(() => {
		window.addEventListener('cast-receiver:nav-down', onNavDown);
	});

	onBeforeUnmount(() => {
		window.removeEventListener('cast-receiver:nav-down', onNavDown);
	});
}

export function focusTopnav(): boolean {
	for (const key of TOPNAV_RESTORATION_KEYS) {
		if (focusStore.requestFocus(key))
			return true;
	}

	return false;
}
