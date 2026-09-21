/**
 * SignalR event payload types per spec §9.2-§9.4. Mirror authoritative
 * server-side shapes from NoMercy.Api/Services/{Music,Video}/* and
 * NoMercy.Api/Hubs/*. Receiver-side narrow definitions — only fields the
 * receiver consumes.
 */

/**
 * Real wire shape (NoMercy.Api.Services.{Video,Music}.*PlayerState,
 * VideoPlayerEvents.cs's EventPayload<PlayerStateEventElement>) — NOT a
 * flat message. The event name is 'VideoPlayerState'/'MusicPlayerState',
 * but the payload is an envelope of events; only 'PlayerStateChanged'
 * entries carry a player snapshot, and `state` is null on session end.
 */
export interface PlayerStateEnvelope<TState> {
	events: Array<{
		event: { event_id: number; state: TState | null };
		source: string;
		type: string;
		user?: unknown;
	}>;
}

export interface VideoPlayerStateSnapshot {
	device_id?: string;
	is_playing?: boolean;
	item?: { id: number; title: string } | null;
	progress_ms?: number;
	duration_ms?: number;
	volume_percentage?: number;
	seq?: number;
}

export interface MusicPlayerStateSnapshot {
	device_id?: string;
	is_playing?: boolean;
	item?: {
		id: string;
		name: string;
		artist_track?: Array<{ name?: string }>;
		cover?: string;
		/** Set for a plugin's media, absent for server media and on an older server. */
		plugin_id?: string | null;
		proxy_url?: string | null;
		live?: boolean;
	} | null;
	progress_ms?: number;
	duration_ms?: number;
	volume_percentage?: number;
	repeat_state?: 'off' | 'one' | 'all';
	shuffle_state?: boolean;
	seq?: number;
}

export type VideoPlayerStateMsg = PlayerStateEnvelope<VideoPlayerStateSnapshot>;
export type MusicPlayerStateMsg = PlayerStateEnvelope<MusicPlayerStateSnapshot>;

export interface DeviceListItemMsg {
	id: string;
	device_id: string;
	name?: string;
	type?: string;
	ip?: string;
	is_online?: boolean;
	is_foreground?: boolean;
	screen_on?: boolean;
}

export interface BroadcastEventPayloadMsg {
	events: Array<{
		device_broadcast_status?: {
			timestamp: number;
			broadcast_status: string;
			device_id: string;
		};
	}>;
}

export type RefreshLibraryPayload = readonly string[];
