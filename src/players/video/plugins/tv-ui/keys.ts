export type KeyName = 'left' | 'right' | 'up' | 'down' | 'center' | 'back' | 'volumeUp' | 'volumeDown' | 'volumeMute' | 'rewind' | 'fastForward' | 'other';

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
} as const satisfies Record<string, KeyName>;

export function keyOf(event: { key: string }): KeyName {
	return (KEY_NAMES as Record<string, KeyName>)[event.key] ?? 'other';
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

const PASS: RootRoute = { action: 'none', consumed: false };

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
			return state.controlsVisible ? PASS : { action: 'togglePlay', consumed: true };
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

export type SharedAction = 'toggleMute' | 'seekBack' | 'seekForward' | 'togglePlay' | 'library';

// VideoChromeStoreAdapter.kt:173-190, the shared player key map.
export function sharedKeyAction(key: KeyName): SharedAction {
	switch (key) {
		case 'volumeMute': return 'toggleMute';
		case 'rewind': return 'seekBack';
		case 'fastForward': return 'seekForward';
		case 'center': return 'togglePlay';
		default: return 'library';
	}
}
