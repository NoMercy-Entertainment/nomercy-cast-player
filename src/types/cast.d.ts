/// <reference types="@types/chromecast-caf-receiver" />

/**
 * LAUNCH customData bundle. Mirrors server-side
 * NoMercy.Setup.Cast.LaunchCustomData (Phase 0). Volatile — receiver holds
 * these in memory only and drops them on cast process unload.
 */
export interface LaunchCustomData {
	access_token: string;
	refresh_token: string;
	user_id: string;
	server_id: string;
	server_url: string;
	device_id: string;
	intent: CastIntent;
	cast_session_id: string;
	launch_timestamp: number;
	client_locale: string;
	features?: {
		debug?: boolean;
		skip_auth?: boolean;
	};
}

export type CastIntent
	= | { type: 'idle' }
		| { type: 'navigate'; route: string }
		| {
			type: 'play_video';
			media_type: 'movie' | 'tv';
			media_id: string;
			resume_at?: number;
			/** The audio and subtitle the handing-off device was playing. */
			audio_language?: string;
			subtitle_language?: string;
			subtitle_type?: string;
			subtitle_codec?: string;
		}
		| {
			type: 'play_music';
			list_type: string;
			list_id: string;
			track_id?: string;
			resume_at?: number;
		};

/**
 * Receiver lifecycle states per spec §8.5.
 */
export type ReceiverState
	= | 'LOADING'
		| 'AUTHED'
		| 'CONNECTING'
		| 'READY'
		| 'DEGRADED'
		| 'TEARDOWN';
