const MEDIA_ABSENT = 'media_absent';

export function mediaAbsentClaims(error: string | null | undefined): boolean {
	return error === MEDIA_ABSENT;
}

// ErrorOverlay.kt getUserFriendlyMessageRes: the first matching group wins.
const MESSAGE_GROUPS = [
	[['exceeds_capabilities', 'codec', 'decoder'], 'player_error_file'],
	[['network', 'timeout', 'connection'], 'player_error_network'],
	[['format', 'unsupported', 'invalid'], 'player_error_file'],
	[['drm', 'license', 'decrypt'], 'player_error_protected'],
	[['source', 'no media'], 'player_error_file'],
	[['transcode'], 'player_error_transcode'],
	[['live', 'stall'], 'player_error_live'],
] as const satisfies ReadonlyArray<readonly [readonly string[], string]>;

export function errorMessageKey(error: string | null | undefined): string {
	if (!error)
		return 'error_unknown';
	const message = error.toLowerCase();
	return MESSAGE_GROUPS.find(([needles]) => needles.some(needle => message.includes(needle)))?.[1] ?? 'player_error_technical';
}

export function errorHintKey(error: string | null | undefined): string | null {
	if (!error)
		return null;
	const message = error.toLowerCase();
	if (['exceeds_capabilities', 'codec', 'profile', 'level'].some(needle => message.includes(needle)))
		return 'player_error_hint_codec';
	if (message.includes('timeout') || message.includes('network'))
		return 'player_error_hint_network';
	if (message.includes('format') && message.includes('unsupported'))
		return 'player_error_hint_format';
	if (message.includes('drm') || message.includes('license'))
		return 'player_error_hint_drm';
	return null;
}
