import { describe, expect, it } from 'vitest';
import { atDecls, decls } from '../cssDecl';

const theme = atDecls('styles/tailwind.css', 'theme');
const tokens = { ...decls('styles/nm-tokens.css', ':root'), ...decls('styles/tokens.css', ':root') };

function resolve(value: string | undefined): string | undefined {
	let v = value;

	for (let i = 0; v && i < 8; i++) {
		const m = v.match(/^var\((--[\w-]+)\)$/);

		const name = m?.[1];

		if (!name) break;

		v = tokens[name];
	}

	return v;
}

// Each theme color reads the token with its role: NM where KMP agrees, KMP where it differs.
describe('the Tailwind theme colors read shared tokens', () => {
	it.each([
		['--color-bg-base', 'var(--cast-bg-base)', '#11181c'], // NoMercyTheme.kt:573 background = slate_12
		['--color-bg-elevated', 'var(--nm-surface)', '#161616'], // TvCardViewHolder.kt:156-159
		['--color-text-primary', 'var(--cast-text-primary)', '#fff'], // NoMercyTheme.kt:576
		['--color-text-secondary', 'var(--cast-text-secondary)', '#f8f9fa'], // NoMercyTheme.kt:578 onSurfaceVariant = slate_2
		['--color-accent', 'var(--cast-accent)', '#8e4ec6'], // NoMercyTheme.kt:557 primary = purple_9, ThemeDataStore.kt:28
	])('%s is %s (%s)', (name, ref, value) => {
		expect(theme[name]).toBe(ref);
		expect(resolve(theme[name])).toBe(value);
	});

	it('holds no color the Cast browser (Chrome 92) cannot read', () => {
		expect(Object.values(theme).join(' ')).not.toMatch(/oklch|oklab|lab\(|lch\(|color-mix/);
	});
});
