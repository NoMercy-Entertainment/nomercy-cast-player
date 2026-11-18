import { VueQueryPlugin } from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { authStore } from '@/stores/authStore';

const fetchMock = vi.fn();
const { useScreensaverQuery } = await import('./useScreensaverQuery');

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	authStore.accessToken.value = 'example-token';
	authStore.serverUrl.value = 'https://server.example.invalid';
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
	authStore.accessToken.value = null;
	authStore.serverUrl.value = null;
});

// ApiServices.kt:271: GET setup/screensaver on the media server, ScreensaverResponse.data is the list.
describe('the screensaver query', () => {
	it('reads the list from the server the receiver is signed in to', async () => {
		const art = { aspectRatio: 1.78, src: '/example.jpg', color_palette: {}, meta: { title: 'Example', logo: null } };

		fetchMock.mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify({ data: [art] })) });

		const seen = { data: undefined as unknown };
		const Host = defineComponent({
			setup() {
				const query = useScreensaverQuery();

				return () => {
					seen.data = query.data.value;

					return null;
				};
			},
		});

		mount(Host, { global: { plugins: [VueQueryPlugin] } });

		await vi.waitFor(() => expect(seen.data).toEqual([art]));
		expect(String(fetchMock.mock.calls[0]![0])).toBe('https://server.example.invalid/api/v1/setup/screensaver');
	});
});
