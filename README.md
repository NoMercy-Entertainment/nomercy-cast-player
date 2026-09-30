# nomercy-cast-player

> **Parked, not dead.** This project is meant to become the web twin of the KMP 10-foot UI, authenticated by postMessage from the cast sender. The current codebase is not functional end to end (see `CLAUDE.md`) and is pinned to v1 player libraries rather than the shipped web trio. See `audit/ALIGNMENT.md` D3 for the decision and `audit/EXECUTION-PLAN.md` "Parked" for the backlog.

**nomercy-cast-player** is a Chromecast Receiver app built to work with the [nomercy-video-player](https://github.com/NoMercy-Entertainment/nomercy-video-player) and [nomercy-music-player](https://github.com/NoMercy-Entertainment/nomercy-music-player). It serves as a lightweight, event-driven application designed to stream media content seamlessly from your NoMercy MediaServer.

## Cast Application ID

This project is associated with the Cast Application ID: `925B4C3C`.

## Features

- Uses the nomercy-video-player and nomercy-music-player for playback, both video and music.
- Supports custom playlists in multiple formats.
- Accepts media configuration via `CustomData`.
- Communicates with the server via SignalR `videoHub`, `musicHub` and `deviceHub` sockets (not `/castHub`).

## Media Requirements

To initiate playback, the application expects a `Media` object to be passed with the following structure:

### Example `media` Object

```ts
const media = {
	customData: {
		accessToken: '', // if the media is behind authentication
		basePath: '', // base path for media URLs
		playlist: `https://example.com/api/v1/tv/1234/watch`, // Playlist URL or array
	}
};
```

### Playlist Formats

The `playlist` property can accept:

1. **A URL string** pointing to the playlist (e.g., `https://example.com/api/v1/tv/1234/watch`).
2. **An array of `PlaylistItem` objects**.

#### Type definitions

Refer to the [nomercy-video-player README](https://github.com/NoMercy-Entertainment/nomercy-video-player?tab=readme-ov-file#playlistitem) for a detailed definition of the `PlaylistItem` format.
note: type definitions and api may not be 100% correct and are subject to change.

## SignalR Communication

### Events Emitted

The player emits the following events to the `videoHub`/`musicHub`/`deviceHub` SignalR sockets:

| Event Name             | Data Type         | Description                                                        |
| ---------------------- | ----------------- | ------------------------------------------------------------------ |
| `Play`                 | -                 | Player started playing.                                            |
| `Pause`                | -                 | Player paused.                                                     |
| `Stop`                 | -                 | Player stopped.                                                    |
| `Ended`                | -                 | Playlist end.                                                      |
| `Time`                 | `TimeData`        | The current playback time and duration. See `TimeData` definition. |
| `Seek`                 | `number`          | The current time.                                                  |
| `Volume`               | `number`          | The current volume level, from `0` to `100`.                       |
| `Muted`                | `boolean`         | Indicates if the player is currently muted.                        |
| `Playlist`             | `PlaylistItem[]`  | The current playlist. See `PlaylistItem` definition.               |
| `Item`                 | `PlaylistItem`    | The currently playing item in the playlist.                        |
| `AudioTracks`          | `MediaPlaylist[]` | A list of available audio tracks. See `MediaPlaylist` definition.  |
| `CurrentAudioTrack`    | `MediaPlaylist`   | The currently selected subtitle track. See `Track` definition.     |
| `SubtitleTracks`       | `Track[]`         | A list of available subtitle tracks. See `Track` definition.       |
| `CurrentSubtitleTrack` | `Track`           | The currently selected subtitle track. See `Track` definition.     |
| `PlayerState`          | `PlayerState`     | The current state of the player.                                   |

### `PlayerState`

| Property               | Type              | Description                                                         |
| ---------------------- | ----------------- | ------------------------------------------------------------------- |
| `time`                 | `TimeData`        | The current playback time and duration. See `TimeData` definition.  |
| `volume`               | `number`          | The current volume level, from `0` to `100`.                        |
| `muted`                | `boolean`         | Indicates if the player is currently muted.                         |
| `playlist`             | `PlaylistItem[]`  | The current playlist. See `PlaylistItem` definition.                |
| `item`                 | `PlaylistItem`    | The currently playing item in the playlist.                         |
| `isPlaying`            | `boolean`         | Indicates if the player is currently playing.                       |
| `subtitles`            | `Track[]`         | A list of available subtitle tracks. See `Track` definition.        |
| `currentSubtitleTrack` | `Track`           | The currently selected subtitle track. See `Track` definition.      |
| `audioTracks`          | `MediaPlaylist[]` | A list of available audio tracks. See `MediaPlaylist` definition.   |
| `currentAudioTrack`    | `MediaPlaylist`   | The currently selected audio track. See `MediaPlaylist` definition. |

### Events Listened To

The player listens to the following events from the `videoHub`/`musicHub`/`deviceHub` SignalR sockets:

| Event Name         | Data Type | Description                                         |
| ------------------ | --------- | --------------------------------------------------- |
| `GetPlayerState`   |           | Requests the current state of the player.           |
| `SetPlay`          |           | Starts playback.                                    |
| `SetPause`         |           | Pauses playback.                                    |
| `SetNext`          |           | Skips to the next item in the playlist.             |
| `SetPrevious`      |           | Skips to the previous item in the playlist.         |
| `SetAudioTrack`    | `number`  | Sets the active audio track index.                  |
| `SetSubtitleTrack` | `number`  | Sets the active subtitle track index.               |
| `SetPlaylistItem`  | `number`  | Sets the current playlist item index.               |
| `SetVolume`        | `number`  | Adjusts the player's volume, from `0` to `100`      |
| `SetSeek`          | `number`  | Seeks to a specific time in the media, in `seconds` |

## Development

`yarn dev` serves the receiver on port 5501. To talk to a NoMercy server from there, copy `.env.example` to `.env` and set `CAST_DEV_SERVER_URL` to your server URL. The dev server then proxies `/api`, `/videoHub` and `/musicHub` to it. Without it the dev server starts without the proxy and prints a warning.

The proxy verifies the server's TLS certificate. For a server with a self-signed certificate, point `NODE_EXTRA_CA_CERTS` at its CA file.

`CAST_DEV_ALLOWED_HOSTS` adds hostnames (comma separated) that may reach the dev server, for example a dev tunnel. `.env` is git-ignored: never put a server address in `vite.config.ts`; CI fails on one.

## Contributions

Contributions are welcome! If you encounter issues or have suggestions for improvement, feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For further information or support, visit NoMercy.tv or contact our support team.

Made with ❤️ by [NoMercy Entertainment](https://nomercy.tv)
