/*
 * PosterBackground.kt:205-260: the static star tile the search page lays over its background.
 * RGBA bytes, cool white with the alpha driven by the glow of a hash of the pixel position.
 */

function smoothstep(edge0: number, edge1: number, x: number): number {
	const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));

	return t * t * (3 - 2 * t);
}

function pseudoNoise(x: number): number {
	const v = Math.sin(x) * 43758.5453123;

	return v - Math.floor(v);
}

export function starNoiseTile(size: number): Uint8ClampedArray<ArrayBuffer> {
	const pixels = new Uint8ClampedArray(new ArrayBuffer(size * size * 4));

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const noise1 = pseudoNoise(x * 12.9898 + y * 78.233);
			const noise2 = pseudoNoise(x * 39.3468 + y * 11.1351);
			const noise3 = pseudoNoise(x * 25.1234 + y * 66.789);
			const gate = noise1 >= 0.996
				? 1
				: 0;
			const glow = noise2 ** 0.75 * noise3 ** 1.3 * gate * 3.5 + smoothstep(0.995, 1, noise1) * 1.2;
			const i = (y * size + x) * 4;

			pixels[i] = 216;
			pixels[i + 1] = 229;
			pixels[i + 2] = 255;
			const alpha = Math.min(1, Math.max(0, glow * 0.8));

			pixels[i + 3] = Math.floor(alpha * 255);
		}
	}

	return pixels;
}
