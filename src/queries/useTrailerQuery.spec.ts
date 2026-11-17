import { VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { authStore } from '@/stores/authStore';

const fetchMock = vi.fn();
const { useTrailerQuery } = await import('./useTrailerQuery');

const READY = {
	success: true,
	data: { videoId: 'abc12345678', cached: true, downloadUrl: 'https://example.test/t.webm', subtitles: [] },
};

function answer(body: unknown, ok = true) {
	return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

function run(videos: unknown[]) {
	const seen = { data: undefined as unknown };
	const Host = defineComponent({
		setup() {
			const query = useTrailerQuery(ref('movie'), ref('12'), ref(videos as never));

			return () => {
				seen.data = query.data.value;

				return null;
			};
		},
	});

	mount(Host, { global: { plugins: [VueQueryPlugin] } });

	return seen;
}

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	authStore.accessToken.value = 'example-token';
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
	authStore.accessToken.value = null;
});

describe('TrailerValidator.kt:171-189: the trailer catalog is asked first', () => {
	it('a title with no info videos but a catalog entry gets its trailer', async () => {
		fetchMock.mockImplementation((url: string) => url.includes('/trailers/tmdb/movie/12')
			? answer({ results: [{ videoId: 'abc12345678' }] })
			: answer(READY));

		const seen = run([]);

		await vi.waitFor(() => expect((seen.data as { state?: string } | undefined)?.state).toBe('available'));
		expect(fetchMock.mock.calls[0]![0]).toContain('/v1/trailers/tmdb/movie/12');
	});

	it('an empty or failing catalog falls back to the info videos', async () => {
		fetchMock.mockImplementation((url: string) => url.includes('/trailers/tmdb/')
			? answer({}, false)
			: answer(READY));

		const seen = run([{ site: 'YouTube', type: 'Trailer', src: 'abc12345678' }]);

		await vi.waitFor(() => expect((seen.data as { state?: string } | undefined)?.state).toBe('available'));
		await flushPromises();
		expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith('/v1/trailers/abc12345678'))).toBe(true);
	});
});
