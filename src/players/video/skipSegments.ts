export interface SkipSegment {
	type: string;
	start?: number;
	end?: number;
	credits_start?: number;
	content_end?: number;
	ocr_only?: boolean;
}

export type SkipAction = 'none' | 'next-button' | 'advance';

export function segmentsForItem(item: unknown): SkipSegment[] {
	if (!item || typeof item !== 'object')
		return [];
	const source = item as { skip_segments?: unknown; segments?: unknown };
	const list = source.skip_segments ?? source.segments;
	return Array.isArray(list) ? list.filter(value => value && typeof value.type === 'string') : [];
}

export function decideSkipAction(position: number, segments: SkipSegment[], hasNext: boolean): SkipAction {
	if (!hasNext || !Number.isFinite(position))
		return 'none';
	const credits = segments.find(segment => segment.type.toLowerCase() === 'credits');
	if (!credits || typeof credits.credits_start !== 'number' || position < credits.credits_start)
		return 'none';
	if (!credits.ocr_only && typeof credits.content_end === 'number' && position >= credits.content_end)
		return 'advance';
	return 'next-button';
}
