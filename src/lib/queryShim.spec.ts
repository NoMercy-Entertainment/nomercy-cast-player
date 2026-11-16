import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/vue-query';
import { createRefreshBatcher, invalidateAllLibrary, mapServerKey, refreshKeyOf, registerQueryClientGetter } from './queryShim';

// The media server's RefreshLibraryDto serializes as { queryKey: [...] } (#78).
describe('refreshLibrary payload', () => {
	it('reads the queryKey of the object the server sends', () => {
		expect(refreshKeyOf({ queryKey: ['tv', '60808'] })).toEqual(['tv', '60808']);
	});

	it('still reads a bare key list', () => {
		expect(refreshKeyOf(['home'])).toEqual(['home']);
	});

	it('ignores a payload with no key', () => {
		expect(refreshKeyOf({})).toBeNull();
		expect(refreshKeyOf(undefined)).toBeNull();
	});
});

describe('refreshLibrary batching', () => {
	it('flushes every distinct key once, 400 ms after the last one', () => {
		vi.useFakeTimers();
		const flushed: string[][] = [];
		const push = createRefreshBatcher(400, (key) =>
			flushed.push([...key]));

		push(['tv', '1']);
		vi.advanceTimersByTime(300);
		push(['tv', '1']);
		push(['home']);
		vi.advanceTimersByTime(399);
		expect(flushed).toEqual([]);
		vi.advanceTimersByTime(1);

		expect(flushed).toEqual([['tv', '1'], ['home']]);
		vi.useRealTimers();
	});
});

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
