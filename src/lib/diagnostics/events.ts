/**
 * Category and code names are shared with the KMP client verbatim, so one
 * dashboard reads a report from any client without a per-client decoder.
 */

export const DIAGNOSTICS_CATEGORIES = [
	'Playback',
	'Network',
	'Memory',
	'Lifecycle',
	'Input',
] as const;

export type DiagnosticsCategoryName = (typeof DIAGNOSTICS_CATEGORIES)[number];

export const DiagnosticsCategory = {
	Playback: 0,
	Network: 1,
	Memory: 2,
	Lifecycle: 3,
	Input: 4,
} as const;

export type DiagnosticsCategoryValue
	= (typeof DiagnosticsCategory)[keyof typeof DiagnosticsCategory];

export const DIAGNOSTICS_CODES = [
	'PlayPressed',
	'SourceRequested',
	'SourceResolved',
	'SourceFailed',
	'Prepared',
	'Buffering',
	'StartWithheld',
	'PlaybackStarted',
	'PlaybackStalled',
	'PlaybackEnded',
	'PlayerError',
	'SocketOpened',
	'SocketClosed',
	'SocketFailed',
	'RequestFailed',
	'HeapSampled',
	'ThreadsSampled',
	'AppForegrounded',
	'CrashReportPending',
	'AppBackgrounded',
	'ScreenOpened',
	'ScreenClosed',
	'KeyPressed',
	// Appended, never reordered: a code is stored as its ordinal and an
	// existing report has to keep decoding.
	'RequestCompleted',
	'SocketConnecting',
	'SocketReconnecting',
	'PlayerEvent',
	'InputAction',
	'VisibilityChanged',
	'CastSessionStarted',
	'CastSessionEnded',
	'ErrorCaught',
	'WarningLogged',
] as const;

export type DiagnosticsCodeName = (typeof DIAGNOSTICS_CODES)[number];

export const DiagnosticsCode = {
	PlayPressed: 0,
	SourceRequested: 1,
	SourceResolved: 2,
	SourceFailed: 3,
	Prepared: 4,
	Buffering: 5,
	StartWithheld: 6,
	PlaybackStarted: 7,
	PlaybackStalled: 8,
	PlaybackEnded: 9,
	PlayerError: 10,
	SocketOpened: 11,
	SocketClosed: 12,
	SocketFailed: 13,
	RequestFailed: 14,
	HeapSampled: 15,
	ThreadsSampled: 16,
	AppForegrounded: 17,
	CrashReportPending: 18,
	AppBackgrounded: 19,
	ScreenOpened: 20,
	ScreenClosed: 21,
	KeyPressed: 22,
	RequestCompleted: 23,
	SocketConnecting: 24,
	SocketReconnecting: 25,
	PlayerEvent: 26,
	InputAction: 27,
	VisibilityChanged: 28,
	CastSessionStarted: 29,
	CastSessionEnded: 30,
	ErrorCaught: 31,
	WarningLogged: 32,
} as const;

export type DiagnosticsCodeValue = (typeof DiagnosticsCode)[keyof typeof DiagnosticsCode];

export interface DiagnosticsEntry {
	atMs: number;
	category: DiagnosticsCategoryName;
	code: DiagnosticsCodeName;
	a: number;
	b: number;
	c: number;
	label?: string;
}
