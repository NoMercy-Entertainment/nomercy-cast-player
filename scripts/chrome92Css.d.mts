import type { Plugin } from 'vite';

export declare function flattenLayers(css: string): string;
export declare function dropColorMixSupports(css: string): string;
export declare function colorToSrgb(color: { type: string; alpha: number }): { type: 'rgb'; r: number; g: number; b: number; alpha: number } | undefined;
export declare const chrome92Targets: { chrome: number };
export declare const chrome92Visitor: { Color: typeof colorToSrgb };
export declare function chrome92Layers(): Plugin;
