import { describe, expect, it } from 'vitest';

// The receiver follows the device language, so a key without Dutch text puts English on a Dutch screen.
const words = import.meta.glob<Record<string, unknown>>('../../**/i18n/*.json', { eager: true, import: 'default' });

function keys(bundle: Record<string, unknown>, prefix = ''): string[] {
	return Object.entries(bundle).flatMap(([key, value]) =>
		value && typeof value === 'object'
			? keys(value as Record<string, unknown>, `${prefix}${key}.`)
			: [`${prefix}${key}`]);
}

function merged(locale: string): Set<string> {
	return new Set(Object.entries(words)
		.filter(([file]) => file.endsWith(`/${locale}.json`))
		.flatMap(([, bundle]) => keys(bundle)));
}

describe('dutch words', () => {
	it('has Dutch text for every English key', () => {
		const nl = merged('nl');
		expect([...merged('en')].filter(key => !nl.has(key))).toEqual([]);
	});
});
