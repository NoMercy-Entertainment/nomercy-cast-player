import { ref } from 'vue';

/**
 * Receiver-side playback store. Reactive snapshot of the music + video
 * engine state, consumed by Now Playing / Watch UI and the SignalR sync
 * bridges. Phase 8 wires the music slice; Phase 9 adds the video slice.
 *
 * Engine instances aren't stored here directly to keep this layer free
 * of npm-package types — the bridge files own the engine and forward
 * state changes through these refs.
 */

export interface PaletteShape {
	dominant?: string;
	primary?: string;
	lightVibrant?: string;
	darkVibrant?: string;
	lightMuted?: string;
	darkMuted?: string;
}

export interface ColorPaletteSnapshot {
	cover?: PaletteShape | null;
	backdrop?: PaletteShape | null;
	image?: PaletteShape | null;
	poster?: PaletteShape | null;
	logo?: PaletteShape | null;
	profile?: PaletteShape | null;
}

export interface CurrentTrackSnapshot {
	id: string;
	name: string;
	artist?: string;
	album?: string;
	cover?: string;
	backdrop?: string | null;
	duration_ms?: number;
	color_palette?: ColorPaletteSnapshot | null;
	favorite?: boolean;
	/** Set for a plugin's media, absent for server media. */
	plugin_id?: string | null;
	/** A stream with no end, which is what stops a progress bar being drawn. */
	live?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface CurrentVideoSnapshot {
	type: 'movie' | 'tv';
	id: string;
	title: string;
	duration_ms?: number;
}

export interface ConnectedDeviceSnapshot {
	device_id: string;
	[key: string]: unknown;
}

const connectedMusicDevices = ref<ConnectedDeviceSnapshot[]>([]);
const accountDevices = ref<ConnectedDeviceSnapshot[]>([]);

const musicTrack = ref<CurrentTrackSnapshot | null>(null);
const musicQueue = ref<CurrentTrackSnapshot[]>([]);
const musicTimeMs = ref<number>(0);
const musicPlaying = ref<boolean>(false);
const musicVolume = ref<number>(100);
const musicShuffle = ref<boolean>(false);
const musicRepeat = ref<RepeatMode>('off');
const musicLyricsOpen = ref<boolean>(false);

const videoItem = ref<CurrentVideoSnapshot | null>(null);
const videoTimeMs = ref<number>(0);
const videoPlaying = ref<boolean>(false);

function applyMusicTime(ms: number): void {
	musicTimeMs.value = ms;
}

function applyMusicTrack(track: CurrentTrackSnapshot | null, queue: CurrentTrackSnapshot[]): void {
	musicTrack.value = track;
	musicQueue.value = queue;
}

function applyMusicPlayState(playing: boolean): void {
	musicPlaying.value = playing;
}

function applyMusicShuffle(enabled: boolean): void {
	musicShuffle.value = enabled;
}

function applyMusicRepeat(mode: RepeatMode): void {
	musicRepeat.value = mode;
}

function applyMusicLyricsOpen(open: boolean): void {
	musicLyricsOpen.value = open;
}

function applyMusicFavorite(favorite: boolean): void {
	if (musicTrack.value)
		musicTrack.value = { ...musicTrack.value, favorite };
}

function applyConnectedMusicDevices(devices: ConnectedDeviceSnapshot[]): void {
	connectedMusicDevices.value = devices
		.filter((device): device is ConnectedDeviceSnapshot => device?.device_id != null)
		.slice()
		.sort((a, b) => a.device_id.localeCompare(b.device_id));
}

function applyAccountDevices(devices: ConnectedDeviceSnapshot[]): void {
	accountDevices.value = devices
		.filter((device): device is ConnectedDeviceSnapshot => device?.device_id != null)
		.slice()
		.sort((a, b) => a.device_id.localeCompare(b.device_id));
}

function applyVideoState(snapshot: CurrentVideoSnapshot | null): void {
	videoItem.value = snapshot;
}

function applyVideoTime(ms: number): void {
	videoTimeMs.value = ms;
}

function applyVideoPlayState(playing: boolean): void {
	videoPlaying.value = playing;
}

export const playbackStore = {
	devices: {
		account: accountDevices,
		applyAccountDevices,
	},
	music: {
		track: musicTrack,
		queue: musicQueue,
		timeMs: musicTimeMs,
		playing: musicPlaying,
		volume: musicVolume,
		shuffle: musicShuffle,
		repeat: musicRepeat,
		lyricsOpen: musicLyricsOpen,
		applyTrack: applyMusicTrack,
		applyTime: applyMusicTime,
		applyPlayState: applyMusicPlayState,
		applyShuffle: applyMusicShuffle,
		applyRepeat: applyMusicRepeat,
		applyLyricsOpen: applyMusicLyricsOpen,
		applyFavorite: applyMusicFavorite,
		connectedDevices: connectedMusicDevices,
		applyConnectedDevices: applyConnectedMusicDevices,
	},
	video: {
		item: videoItem,
		timeMs: videoTimeMs,
		playing: videoPlaying,
		applyState: applyVideoState,
		applyTime: applyVideoTime,
		applyPlayState: applyVideoPlayState,
	},
};
