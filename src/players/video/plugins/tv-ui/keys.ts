export type KeyName = 'left' | 'right' | 'up' | 'down' | 'center' | 'back' | 'volumeUp' | 'volumeDown' | 'volumeMute' | 'rewind' | 'fastForward' | 'playPause' | 'next' | 'previous' | 'stop' | 'other';

const KEY_NAMES = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
	Enter: 'center',
	Escape: 'back',
	Back: 'back',
	GoBack: 'back',
	BrowserBack: 'back',
	XF86Back: 'back',
	AudioVolumeUp: 'volumeUp',
	AudioVolumeDown: 'volumeDown',
	AudioVolumeMute: 'volumeMute',
	MediaRewind: 'rewind',
	MediaFastForward: 'fastForward',
	MediaPlayPause: 'playPause',
	MediaTrackNext: 'next',
	MediaTrackPrevious: 'previous',
	MediaStop: 'stop',
} as const satisfies Record<string, KeyName>;

// webOS and Tizen remotes send Back with no usable key name.
const BACK_KEY_CODES = [461, 10009];

export function keyOf(event: { key: string; keyCode?: number }): KeyName {
	const named = (KEY_NAMES as Record<string, KeyName>)[event.key];

	if (named)
		return named;

	return event.keyCode !== undefined && BACK_KEY_CODES.includes(event.keyCode)
		? 'back'
		: 'other';
}

export interface RootKeyState {
	preScreen: boolean;
	dialogOpen: boolean;
	seekMode: boolean;
	controlsVisible: boolean;
	topBarFocused: boolean;
	duration: number;
}

export type RootAction = 'none' | 'enterSeek' | 'showControls' | 'rescheduleHide' | 'togglePlay' | 'volume' | 'shared';

export interface RootRoute {
	action: RootAction;
	consumed: boolean;
}

const PASS = { action: 'none', consumed: false } as const satisfies RootRoute;

// TvUiPlugin.kt:502-619, the root key router.
export function routeRootKey(state: RootKeyState, key: KeyName): RootRoute {
	if (state.dialogOpen || state.seekMode)
		return PASS;

	switch (key) {
		case 'left':
		case 'right':
			if (state.preScreen || state.topBarFocused || state.duration <= 0)
				return PASS;

			return { action: 'enterSeek', consumed: true };
		case 'up':
		case 'down':
			if (state.preScreen)
				return PASS;

			return state.controlsVisible
				? { action: 'rescheduleHide', consumed: false }
				: { action: 'showControls', consumed: true };
		case 'center':
			// The focused pre-screen button takes Enter first (LinkButton.kt:137-142).
			return state.controlsVisible || state.preScreen
				? PASS
				: { action: 'togglePlay', consumed: true };
		case 'volumeUp':
		case 'volumeDown':
		case 'volumeMute':
			return { action: 'volume', consumed: false };
		case 'back':
			return PASS;
		default:
			return { action: 'shared', consumed: false };
	}
}

export type SharedAction = 'toggleMute' | 'seekBack' | 'seekForward' | 'togglePlay' | 'next' | 'previous' | 'stop' | 'library';

// VideoChromeStoreAdapter.kt:173-190, the shared player key map.
export function sharedKeyAction(key: KeyName): SharedAction {
	switch (key) {
		case 'volumeMute': return 'toggleMute';
		case 'rewind': return 'seekBack';
		case 'fastForward': return 'seekForward';
		case 'center':
		case 'playPause': return 'togglePlay';
		case 'next': return 'next';
		case 'previous': return 'previous';
		case 'stop': return 'stop';
		default: return 'library';
	}
}
