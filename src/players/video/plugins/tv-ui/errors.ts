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

// LiveTranscodeError.kt:65-76 transcodeReasonRes: one reason line per failure kind.
const TRANSCODE_REASONS = [
	[['DiskFull'], 'transcode_reason_disk_full'],
	[['HardwareFailure', 'HardwareUnavailable'], 'transcode_reason_hardware'],
	[['InputNotFound'], 'transcode_reason_input_not_found'],
	[['InputCorrupt'], 'transcode_reason_input_corrupt'],
	[['InputUnsupported', 'CodecUnavailable', 'ProfileInvalid'], 'transcode_reason_unsupported'],
	[['Timeout'], 'transcode_reason_timeout'],
	[['NetworkPathUnavailable', 'NetworkPathTimeout', 'NetworkPathPermission'], 'transcode_reason_storage'],
	[['ResourceExhausted'], 'transcode_reason_busy'],
	[['InputDrmProtected'], 'transcode_reason_protected'],
] as const satisfies ReadonlyArray<readonly [readonly string[], string]>;

export const LIVE_TRANSCODE_FAILED = 'live-transcode/failed';

export function transcodeReasonKey(kind: string | undefined): string {
	return TRANSCODE_REASONS.find(([kinds]) => (kinds as readonly string[]).includes(kind ?? ''))?.[1] ?? 'transcode_reason_generic';
}

export function errorMessageKey(error: string | null | undefined): string {
	if (!error)
		return 'error_unknown';

	const message = error.toLowerCase();

	return MESSAGE_GROUPS.find(([needles]) => needles.some((needle) => message.includes(needle)))?.[1] ?? 'player_error_technical';
}

export function errorHintKey(error: string | null | undefined): string | null {
	if (!error)
		return null;

	const message = error.toLowerCase();

	if (['exceeds_capabilities', 'codec', 'profile', 'level'].some((needle) => message.includes(needle)))
		return 'player_error_hint_codec';

	if (message.includes('timeout') || message.includes('network'))
		return 'player_error_hint_network';

	if (message.includes('format') && message.includes('unsupported'))
		return 'player_error_hint_format';

	if (message.includes('drm') || message.includes('license'))
		return 'player_error_hint_drm';

	return null;
}
