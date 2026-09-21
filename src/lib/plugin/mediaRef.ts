/**
 * What a plugin media card carries, in the shape every client agrees on.
 *
 * The same words as the web client and the server. A fourth spelling here is
 * how a card renders on one screen and nowhere else.
 */
export interface PluginMediaRef {
	pluginId: string;
	mediaId: string;
	kind: 'audio' | 'video';
	live: boolean;
	/** Host minted, short lived, user bound. Never built here. */
	url: string;
	title: string;
	artist?: string | null;
	cover?: string | null;
}

const CREDENTIAL_PARAM = /^(?:token|key|auth|signature|sig|password|access_token|api_key)$/i;

/**
 * Whether a url names a credential.
 *
 * Read from the query parameter names rather than by guessing at values: a long
 * opaque path segment is an id, and refusing those would refuse every real media
 * url the host mints. A token in a url is a credential in a log and on a screen
 * four meters wide.
 */
export function carriesToken(url: string): boolean {
	const query: string = url.split('?')[1] ?? '';

	return query
		.split('&')
		.some(pair => CREDENTIAL_PARAM.test(decodeURIComponent(pair.split('=')[0] ?? '')));
}

/** The frame item a plugin's media becomes, so the receiver plays it as its own. */
export interface PluginFrameItem {
	id: string;
	name: string;
	path: string;
	cover: string | null;
	plugin_id: string;
	live: boolean;
}

export function toFrameItem(media: PluginMediaRef): PluginFrameItem | null {
	if (carriesToken(media.url))
		return null;

	return {
		id: `plugin:${media.pluginId}:${media.mediaId}`,
		name: media.title,
		path: media.url,
		cover: media.cover ?? null,
		plugin_id: media.pluginId,
		live: media.live,
	};
}
