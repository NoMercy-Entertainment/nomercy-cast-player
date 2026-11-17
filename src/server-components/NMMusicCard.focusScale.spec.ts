import { describe, expect, it } from 'vitest';
import { decls } from '@/test/cssDecl';

const FILE = 'server-components/NMMusicCard.vue';

describe('nMMusicCard focus scale (NMMusicCard.kt:135-149, 197-198)', () => {
	it('grows to 1.03 on focus', () => {
		expect(decls(FILE, '.music-card:focus-visible').transform).toBe('scale(1.03)');
	});

	it('tweens in 120 ms with FastOutSlowIn', () => {
		expect(decls(FILE, '.music-card').transition).toBe('transform 120ms cubic-bezier(0.4, 0, 0.2, 1)');
	});
});
