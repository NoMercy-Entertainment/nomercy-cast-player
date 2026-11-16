import { describe, expect, it } from 'vitest';
import { keyOf, routeRootKey, sharedKeyAction } from './keys';
import type { RootKeyState } from './keys';

const base: RootKeyState = {
	preScreen: false,
	dialogOpen: false,
	seekMode: false,
	controlsVisible: false,
	topBarFocused: false,
	duration: 100,
};

describe('keyOf (web key names to the KMP key codes)', () => {
	it.each([
		['ArrowLeft', 'left'],
		['ArrowRight', 'right'],
		['ArrowUp', 'up'],
		['ArrowDown', 'down'],
		['Enter', 'center'],
		['Escape', 'back'],
		['GoBack', 'back'],
		['BrowserBack', 'back'],
		['AudioVolumeUp', 'volumeUp'],
		['AudioVolumeDown', 'volumeDown'],
		['AudioVolumeMute', 'volumeMute'],
		['MediaRewind', 'rewind'],
		['MediaFastForward', 'fastForward'],
		['x', 'other'],
	])('%s is %s', (key, name) => {
		expect(keyOf({ key })).toBe(name);
	});
});

describe('routeRootKey (TvUiPlugin.kt:502-619)', () => {
	it('K01 every key is left alone while a dialog or the settings panel is open', () => {
		for (const key of ['left', 'right', 'up', 'down', 'center', 'back', 'other'] as const)
			expect(routeRootKey({ ...base, dialogOpen: true }, key)).toEqual({ action: 'none', consumed: false });
	});

	it('K03 seek mode leaves every key to the scrub strip', () => {
		expect(routeRootKey({ ...base, seekMode: true }, 'left')).toEqual({ action: 'none', consumed: false });
	});

	it.each(['left', 'right'] as const)('K04 %s on the pre-screen is not handled', (key) => {
		expect(routeRootKey({ ...base, preScreen: true }, key)).toEqual({ action: 'none', consumed: false });
	});

	it.each(['left', 'right'] as const)('K05 %s enters seek mode when the duration is known', (key) => {
		expect(routeRootKey(base, key)).toEqual({ action: 'enterSeek', consumed: true });
	});

	it('K06 left is not consumed when the duration is unknown or the top bar holds focus', () => {
		expect(routeRootKey({ ...base, duration: 0 }, 'left')).toEqual({ action: 'none', consumed: false });
		expect(routeRootKey({ ...base, topBarFocused: true }, 'left')).toEqual({ action: 'none', consumed: false });
	});

	it('K07 up and down on the pre-screen are not handled', () => {
		expect(routeRootKey({ ...base, preScreen: true }, 'up')).toEqual({ action: 'none', consumed: false });
	});

	it('K08 up and down with controls visible reschedule the hide and pass through', () => {
		expect(routeRootKey({ ...base, controlsVisible: true }, 'down')).toEqual({ action: 'rescheduleHide', consumed: false });
	});

	it('K09 up and down with controls hidden show them and are consumed', () => {
		expect(routeRootKey(base, 'up')).toEqual({ action: 'showControls', consumed: true });
	});

	it('K10 center with controls hidden toggles play and pause', () => {
		expect(routeRootKey(base, 'center')).toEqual({ action: 'togglePlay', consumed: true });
	});

	it('K11 center with controls visible is not consumed', () => {
		expect(routeRootKey({ ...base, controlsVisible: true }, 'center')).toEqual({ action: 'none', consumed: false });
	});

	it.each(['volumeUp', 'volumeDown', 'volumeMute'] as const)('K13 %s shows the indicator and passes through', (key) => {
		expect(routeRootKey(base, key)).toEqual({ action: 'volume', consumed: false });
	});

	it('K14 any other key goes to the shared key map', () => {
		expect(routeRootKey(base, 'other')).toEqual({ action: 'shared', consumed: false });
	});
});

describe('sharedKeyAction (VideoChromeStoreAdapter.kt:181-188)', () => {
	it('H01 volume mute toggles mute', () => expect(sharedKeyAction('volumeMute')).toBe('toggleMute'));
	it('H02 rewind is a chapter-aware seek back', () => expect(sharedKeyAction('rewind')).toBe('seekBack'));
	it('H03 fast forward is a chapter-aware seek forward', () => expect(sharedKeyAction('fastForward')).toBe('seekForward'));
	it('H04 center toggles play and pause', () => expect(sharedKeyAction('center')).toBe('togglePlay'));
	it('H05 everything else goes to the library key handler', () => expect(sharedKeyAction('other')).toBe('library'));
});
