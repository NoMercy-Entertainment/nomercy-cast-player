import { ref, shallowRef } from 'vue';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'back';

export type FocusGroupType = 'horizontal' | 'vertical' | 'grid' | 'modal' | 'free';

export interface FocusGroupHandle {
	type: FocusGroupType;
	handleKey: (dir: Direction) => boolean;
	focusFirst: () => boolean;
	focusLast: () => boolean;
	focusByKey: (key: string) => boolean;
	/** Used by focusStore.requestFocus to walk the stack from bottom up. */
	hasEntry: (key: string) => boolean;
	/** True when one of this group's entries is the document's activeElement. */
	containsFocused: () => boolean;
	/** Internal: triggers `escape` callback so modals can close on Back. */
	dispatchEscape: () => boolean;
}

/**
 * Active group stack. Modals push, Back pops. Top-of-stack is the only
 * group that handles d-pad input; lower groups are paused.
 */
const groupStack = shallowRef<FocusGroupHandle[]>([]);

/**
 * Per-restoration-key map of the last-focused entry's stable key. Used to
 * rehydrate focus when groups remount (rail re-renders, route revisits).
 */
const restoration = ref<Map<string, string>>(new Map());

/** Bumped when any group gains an entry, so a page group can retry its first focus. */
const entryChanges = ref(0);

/** Focus-entry action per element, so OK can run it without a click. */
const actionByEl = new WeakMap<HTMLElement, () => void>();

function activeGroup(): FocusGroupHandle | null {
	const stack = groupStack.value;
	if (stack.length === 0)
		return null;
	// Prefer the group that owns the currently-focused element. Multiple
	// nested groups push onto the stack (page → rails → carousels), so the
	// LAST mounted group isn't always the right key handler. Walk top-down
	// looking for the group whose containsFocused() reports true.
	for (let i = stack.length - 1; i >= 0; i--) {
		const group = stack[i];
		if (group.containsFocused())
			return group;
	}
	// Fall back to the topmost group when focus is on document.body or
	// hasn't been initialised yet (first paint).
	return stack[stack.length - 1] ?? null;
}

function pushGroup(group: FocusGroupHandle): void {
	groupStack.value = [...groupStack.value, group];
}

function popGroup(group: FocusGroupHandle): void {
	groupStack.value = groupStack.value.filter(g => g !== group);
}

function saveRestoration(key: string, entryKey: string): void {
	restoration.value.set(key, entryKey);
}

function consumeRestoration(key: string): string | undefined {
	return restoration.value.get(key);
}

/**
 * Trigger Enter on the focused element. The browser does this natively
 * for buttons/links, but custom focusable divs need explicit handling.
 * Fires a synthetic 'click' on document.activeElement so onAction handlers
 * registered via @click resolve uniformly.
 */
function dispatchAction(): boolean {
	const el = document.activeElement as HTMLElement | null;
	if (!el || el === document.body)
		return false;
	// A focus entry's action runs once here; a click would run a row's @click too.
	const action = actionByEl.get(el);
	if (action)
		action();
	else
		el.click();
	return true;
}

/** Bind a focused element to its focus entry's action. Returns the unbind. */
function registerAction(el: HTMLElement, action: () => void): () => void {
	actionByEl.set(el, action);
	return () => {
		if (actionByEl.get(el) === action)
			actionByEl.delete(el);
	};
}

function dispatchEscape(): boolean {
	const top = activeGroup();
	return top ? top.dispatchEscape() : false;
}

/**
 * Walk the group stack from bottom up looking for an entry with this key.
 * Used for sender-driven focus override (phone tapped 'play' → receiver
 * navigates AND focuses the play button).
 */
function requestFocus(key: string): boolean {
	for (const g of groupStack.value) {
		if (g.hasEntry(key)) {
			return g.focusByKey(key);
		}
	}
	return false;
}

export const focusStore = {
	groupStack,
	entryChanges,
	activeGroup,
	pushGroup,
	popGroup,
	saveRestoration,
	consumeRestoration,
	dispatchAction,
	registerAction,
	dispatchEscape,
	requestFocus,
};
