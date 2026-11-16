import { apiFetch, HttpError } from '@/lib/http/client';

export interface SubtitleCandidate {
	id: string;
	downloadUrl: string;
	language: string;
	languageName: string;
	releaseName?: string;
	fileName?: string;
	downloads: number;
	format: string;
	hearingImpaired: boolean;
}

export interface DownloadedSubtitle {
	file: string;
	kind: string;
	label: string;
	language: string;
}

export interface SearchTarget {
	type: string;
	id: number;
	videoFileId?: string;
}

interface RawCandidate {
	id: string;
	download_url: string;
	language: string;
	language_name: string;
	release_name?: string | null;
	file_name?: string | null;
	downloads?: number;
	format: string;
	hearing_impaired?: boolean;
}

interface PlayingItem {
	id?: number | string;
	tmdb_id?: number;
	video_id?: string;
	video_type?: string;
}

// SubtitleSearchDialog.kt:38-41: the playing item names the target, a show by its tmdb id.
export function searchTarget(item: PlayingItem | undefined): SearchTarget | null {
	const type = item?.video_type;
	const id = Number(type === 'tv'
		? (item?.tmdb_id ?? item?.id)
		: item?.id);

	if (!type || !Number.isFinite(id))
		return null;

	return {
		type,
		id,
		videoFileId: item?.video_id,
	};
}

export function isRateLimited(error: unknown): boolean {
	return error instanceof HttpError && error.status === 429;
}

export async function searchSubtitles(target: SearchTarget, language: string): Promise<SubtitleCandidate[]> {
	const query = new URLSearchParams({ type: target.type, id: String(target.id) });

	if (target.videoFileId) {
		query.set('videoFileId', target.videoFileId);
	}

	query.set('language', language);
	const body = await apiFetch<{ data?: RawCandidate[] }>({ path: `/api/v1/subtitles/search?${query.toString()}`, method: 'GET' });

	return (body.data ?? []).map((raw) => ({
		id: raw.id,
		downloadUrl: raw.download_url,
		language: raw.language,
		languageName: raw.language_name,
		releaseName: raw.release_name ?? undefined,
		fileName: raw.file_name ?? undefined,
		downloads: raw.downloads ?? 0,
		format: raw.format,
		hearingImpaired: raw.hearing_impaired ?? false,
	}));
}

export async function downloadSubtitle(target: SearchTarget, candidate: SubtitleCandidate): Promise<DownloadedSubtitle> {
	const body = await apiFetch<{ data: DownloadedSubtitle }>({
		path: '/api/v1/subtitles/download',
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: target.type,
			id: target.id,
			video_file_id: target.videoFileId,
			download_url: candidate.downloadUrl,
			language: candidate.language,
			format: candidate.format,
		}),
	});

	return body.data;
}
