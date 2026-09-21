import { describe, expect, it } from 'vitest';

import { canSee, visibleEntries } from './access';

describe('what the sender\'s account may see on the television', () => {
	it('shows what the account owns or was shared', () => {
		expect(canSee('owned')).toBe(true);
		expect(canSee('shared')).toBe(true);
	});

	it('shows nothing the account has no access to', () => {
		expect(canSee('none')).toBe(false);
	});

	it('treats an answer the server did not give as shared, so an older server still draws', () => {
		expect(canSee(undefined)).toBe(true);
		expect(canSee(null)).toBe(true);
	});

	it('drops the refused entries and keeps the rest in order', () => {
		const entries = [
			{ id: 'a', access: 'owned' },
			{ id: 'b', access: 'none' },
			{ id: 'c', access: 'shared' },
		];

		expect(visibleEntries(entries).map(one => one.id)).toEqual(['a', 'c']);
	});
});
