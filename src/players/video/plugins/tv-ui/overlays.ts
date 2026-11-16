import { el, focusable, t } from './dom';

export interface FirstFrameState {
	preScreen: boolean;
	duration: number;
	time: number;
}

// TvUiPlugin.kt:630: the item's backdrop stands in for the picture until a frame plays.
export function showBackdrop(state: FirstFrameState): boolean {
	return !state.preScreen && (state.duration <= 0 || state.time === 0);
}

// TvUiPlugin.kt:668.
export function showLoading(state: FirstFrameState & { playing: boolean }): boolean {
	return !state.preScreen && (state.duration <= 0 || (state.time === 0 && !state.playing));
}

function layer(className: string, image: string | null): HTMLElement {
	const node = el('div', className);

	if (image) {
		node.style.backgroundImage = `url("${image}")`;
	}

	return node;
}

export function backdropLayer(image: string): HTMLElement {
	const node = layer('tvui-backdrop', image);

	node.setAttribute('role', 'img');
	node.setAttribute('aria-label', t('player_backdrop'));

	return node;
}

// CastLoadingOverlay.kt:39-90: the item image under a dark gradient, a spinner and two lines.
export function loadingLayer(image: string | null): HTMLElement {
	const art = layer('tvui-loading-art', image);
	const title = el('div', 'tvui-loading-title', t('player_loading'));
	const subtitle = el('div', 'tvui-loading-subtitle', t('player_preparing'));
	const node = el('div', 'tvui-loading', art, el('div', 'tvui-spinner'), title, subtitle);

	node.setAttribute('role', 'status');

	return node;
}

// CenterMessage.kt:30-47.
export function centerMessage(text: string): HTMLElement {
	const node = el('div', 'tvui-center-message', text);

	node.setAttribute('role', 'status');

	return node;
}

export function skipPrompt(label: string, onSkip: () => void): HTMLElement {
	const node = focusable(el('button', 'tvui-button tvui-skip', label), onSkip);

	node.dataset.skipPrompt = 'true';

	return node;
}
