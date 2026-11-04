import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/vue-query';
import { invalidateAllLibrary, mapServerKey, registerQueryClientGetter } from './queryShim';

describe('live TV playlist invalidation', () => {
	it('maps a show refresh to its watch playlist', () => {
		expect(mapServerKey(['tv', 'placeholder-show']))
			.toContainEqual(['playlist', 'tv', 'placeholder-show']);
	});

	it('refetches playlists after a socket reconnect', () => {
		const invalidateQueries = vi.fn();
		registerQueryClientGetter(() => ({ invalidateQueries }) as unknown as QueryClient);

		invalidateAllLibrary();

		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['playlist'], exact: false });
	});
});
