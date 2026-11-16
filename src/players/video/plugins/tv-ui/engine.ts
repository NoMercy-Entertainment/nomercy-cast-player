import type { SubtitleStyle } from '@nomercy-entertainment/nomercy-video-player';

// KMP stores the size in sp against a 24 sp base; the engine takes a percent of its base size.
const BASE_SP = 24;

const EDGE_TO_ENGINE: Record<string, SubtitleStyle['edgeStyle']> = {
	none: 'none',
	depressed: 'depressed',
	drop_shadow: 'dropShadow',
	raised: 'raised',
	uniform: 'uniform',
	text_shadow: 'textShadow',
};

export interface ViewStyle {
	fontSize: number;
	fontFamily: string;
	fontColor: string;
	backgroundOpacity: number;
	edgeStyle: string;
}

export function isPlaying(engine: { playState?: () => string }): boolean {
	return engine.playState?.() === 'playing';
}

export function readVolume(engine: { volume?: () => number; volumeState?: () => string }): { level: number; muted: boolean } {
	return { level: (engine.volume?.() ?? 0) / 100, muted: engine.volumeState?.() === 'muted' };
}

export function toEngineStyle(patch: Partial<ViewStyle>): Partial<SubtitleStyle> {
	const out: Partial<SubtitleStyle> = {};
	if (patch.fontSize !== undefined)
		out.fontSize = Math.round(patch.fontSize / BASE_SP * 100);
	if (patch.fontFamily !== undefined)
		out.fontFamily = patch.fontFamily;
	if (patch.fontColor !== undefined)
		out.textColor = patch.fontColor;
	if (patch.backgroundOpacity !== undefined)
		out.backgroundOpacity = Math.round(patch.backgroundOpacity * 100);
	if (patch.edgeStyle !== undefined)
		out.edgeStyle = EDGE_TO_ENGINE[patch.edgeStyle] ?? 'none';
	return out;
}

export function fromEngineStyle(style: Partial<SubtitleStyle> | undefined): ViewStyle {
	const edge = Object.entries(EDGE_TO_ENGINE).find(([, value]) => value === style?.edgeStyle)?.[0] ?? 'none';
	return {
		fontSize: Math.round((style?.fontSize ?? 100) / 100 * BASE_SP),
		fontFamily: style?.fontFamily ?? '',
		fontColor: style?.textColor ?? 'white',
		backgroundOpacity: (style?.backgroundOpacity ?? 0) / 100,
		edgeStyle: edge,
	};
}
