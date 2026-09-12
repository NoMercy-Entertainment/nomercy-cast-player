import { nomercyApiBase } from '@/lib/nomercyApi';

/**
 * The trailer lookup, against the authenticated NoMercy API. Same endpoint
 * and the same decisions as app-web's useTrailerService and the KMP
 * TrailerValidator, so all three clients agree on when a trailer exists.
 */

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/;
const BARE_ID = /^[\w-]{11}$/;

/** The fields of an info-page video this needs. */
export interface VideoRef {
	site?: string;
	type?: string;
	src?: string;
	official?: boolean;
}

interface WireSubtitle {
	file: string;
	lang: string;
	url: string;
}

interface WireResponse {
	success: boolean;
	status?: string;
	data: {
		videoId: string;
		title?: string | null;
		cached?: boolean;
		processing?: boolean;
		downloadUrl?: string;
		subtitles?: WireSubtitle[];
	};
}

export interface TrailerSubtitle {
	language: string;
	url: string;
}

export interface ResolvedTrailer {
	videoId: string;
	title: string | null;
	/** Absolute and signed. Used exactly as delivered. */
	url: string;
	subtitles: TrailerSubtitle[];
}

export type TrailerLookup
	= | { state: 'available'; trailer: ResolvedTrailer }
		| { state: 'processing'; videoId: string }
		| { state: 'unavailable' };

export function youTubeId(src: string | undefined): string | null {
	if (!src)
		return null;
	const match = src.match(YOUTUBE_ID);
	if (match)
		return match[1];
	return BARE_ID.test(src) ? src : null;
}

/** YouTube trailers, official first, the order the KMP TV screen tries them. */
export function trailerCandidates(videos: VideoRef[] | undefined): string[] {
	return (videos ?? [])
		.filter(v => v.site?.toLowerCase() === 'youtube' && v.type?.toLowerCase() === 'trailer')
		.sort((a, b) => Number(b.official === true) - Number(a.official === true))
		.map(v => youTubeId(v.src))
		.filter((id): id is string => id !== null);
}

export function toLookup(body: WireResponse | null): TrailerLookup {
	if (!body?.success)
		return { state: 'unavailable' };

	const { data } = body;

	if (data.cached && data.downloadUrl) {
		return {
			state: 'available',
			trailer: {
				videoId: data.videoId,
				title: data.title && data.title !== data.videoId ? data.title : null,
				url: data.downloadUrl,
				// The API names the language `lang`. Reading any other field
				// is the bug app-web shipped: every track had no language.
				subtitles: (data.subtitles ?? []).map(sub => ({ language: sub.lang, url: sub.url })),
			},
		};
	}

	if (data.processing || body.status === 'queued')
		return { state: 'processing', videoId: data.videoId };

	return { state: 'unavailable' };
}

async function lookup(videoId: string, accessToken: string): Promise<TrailerLookup> {
	try {
		const res = await fetch(`${nomercyApiBase(accessToken)}/v1/trailers/${videoId}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/json',
			},
		});
		return toLookup(await res.json() as WireResponse);
	}
	catch {
		return { state: 'unavailable' };
	}
}

/**
 * The first candidate that is ready wins. A candidate still being processed
 * is reported as such, so the caller can ask again later rather than showing
 * a button that opens nothing.
 */
export async function findTrailer(candidates: string[], accessToken: string): Promise<TrailerLookup> {
	let processing: TrailerLookup | null = null;

	for (const videoId of candidates) {
		const result = await lookup(videoId, accessToken);

		if (result.state === 'available')
			return result;

		if (result.state === 'processing' && processing === null)
			processing = result;
	}

	return processing ?? { state: 'unavailable' };
}
