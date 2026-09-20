import { onBeforeUnmount, onMounted } from 'vue';
import type { Router } from 'vue-router';
import { focusStore } from '@/stores/focusStore';
import { focusedCardStore } from '@/stores/focusedCardStore';
import { screensaverStore } from '@/stores/screensaverStore';
import { DiagnosticsCategory, DiagnosticsCode } from '@/lib/diagnostics/events';
import { recordDiagnostic } from '@/lib/diagnostics/sink';

/**
 * Window-level D-pad handler per spec §10.5. Mounted once at App.vue.
 * Handles arrow keys, Enter, and the cluster of Back-equivalent keys
 * (Escape / Back / GoBack / BrowserBack) used by various smart-TV remote
 * shells.
 */

const DPAD_KEYS = new Set([
	'ArrowUp',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'Enter',
	'Escape',
	'Back',
	'GoBack',
	'BrowserBack',
]);

function isInputFocused(): boolean {
	const el = document.activeElement;
	if (!el)
		return false;
	const tag = el.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

export function useDPad(router: Router): void {
	function handler(e: KeyboardEvent): void {
		// Every key, bound or not. A remote button the receiver never learned
		// is invisible to a report that only records the nine it handles.
		// See specs/nomercy-app-kmp/diagnostics-capture-everything.md.
		recordDiagnostic(DiagnosticsCategory.Input, DiagnosticsCode.KeyPressed, e.repeat ? 1 : 0, 0, 0, e.code || e.key);

		if (!DPAD_KEYS.has(e.key))
			return;
		if (isInputFocused())
			return;

		// Any D-pad press resets the idle timer — and if the screensaver is
		// active, the first press dismisses it without consuming the input
		// for normal traversal. That way the ambient overlay clears
		// immediately and the user's next intent (the same key, repeated)
		// moves focus naturally.
		const wasScreensaverActive = screensaverStore.active.value;
		screensaverStore.resetIdle();
		if (wasScreensaverActive) {
			e.preventDefault();
			return;
		}

		const active = focusStore.activeGroup();
		let handled = false;

		switch (e.key) {
			case 'ArrowUp':
				focusedCardStore.setNavDirection('vertical');
				handled = active?.handleKey('up') ?? false;
				break;
			case 'ArrowDown':
				focusedCardStore.setNavDirection('vertical');
				handled = active?.handleKey('down') ?? false;
				break;
			case 'ArrowLeft':
				focusedCardStore.setNavDirection('horizontal');
				handled = active?.handleKey('left') ?? false;
				break;
			case 'ArrowRight':
				focusedCardStore.setNavDirection('horizontal');
				handled = active?.handleKey('right') ?? false;
				break;
			case 'Enter':
				handled = focusStore.dispatchAction();
				break;
			case 'Escape':
			case 'Back':
			case 'GoBack':
			case 'BrowserBack':
				handled = handleBack(router);
				break;
		}

		if (handled)
			e.preventDefault();
	}

	onMounted(() => window.addEventListener('keydown', handler, { capture: true }));
	onBeforeUnmount(() => window.removeEventListener('keydown', handler, true));
}

function handleBack(router: Router): boolean {
	// Modal on top? Close it via dispatchEscape.
	const top = focusStore.activeGroup();
	if (top?.type === 'modal') {
		return focusStore.dispatchEscape();
	}
	// Otherwise router back. At root we let cast_shell decide (which
	// typically does nothing).
	if (router.currentRoute.value.path !== '/') {
		router.back();
		return true;
	}
	return false;
}
