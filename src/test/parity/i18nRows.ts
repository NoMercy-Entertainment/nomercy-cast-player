import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import i18n from '@/i18n/i18next';

// One row: the source file must no longer hold the raw English, and the key must give that English.
export type I18nRow = [file: string, raw: string, key: string, en: string, nl?: string];

const srcRoot = `${process.cwd()}/src/`;

export function checkRows(group: string, rows: I18nRow[]): void {
	for (const [file, raw, key, en, nl] of rows) {
		it(`${group}: ${file} reads ${key} instead of "${raw}"`, () => {
			expect(readFileSync(srcRoot + file, 'utf8')).not.toContain(raw);
			expect(i18n.t(key)).toBe(en);

			const dutch = nl
				? i18n.t(key, { lng: 'nl' })
				: undefined;

			expect(dutch).toBe(nl);
		});
	}
}
