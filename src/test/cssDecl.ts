import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseSfc } from '@vue/compiler-sfc';
import postcss from 'postcss';

const root = resolve(__dirname, '..');

function cssOf(file: string): string {
	const text = readFileSync(resolve(root, file), 'utf8');
	if (!file.endsWith('.vue'))
		return text;
	return parseSfc(text).descriptor.styles.map(s => s.content).join('\n');
}

/**
 * Declarations that apply to `selector` in a stylesheet or a .vue file, later
 * rules winning. `selector` matches one whole entry of a rule's selector list.
 */
export function decls(file: string, selector: string): Record<string, string> {
	const out: Record<string, string> = {};
	postcss.parse(cssOf(file)).walkRules((rule) => {
		const hit = rule.selectors.some(s => s.replace(/\s+/g, ' ').trim() === selector);
		if (!hit)
			return;
		rule.walkDecls((d) => {
			out[d.prop] = d.value.replace(/\s+/g, ' ').trim();
		});
	});
	return out;
}

/** Declarations inside an at-rule such as `@theme`. */
export function atDecls(file: string, name: string): Record<string, string> {
	const out: Record<string, string> = {};
	postcss.parse(cssOf(file)).walkAtRules(name, (at) => {
		at.walkDecls((d) => {
			out[d.prop] = d.value.replace(/\s+/g, ' ').trim();
		});
	});
	return out;
}
