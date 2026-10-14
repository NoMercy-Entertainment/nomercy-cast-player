import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveServerFromAppConfig } from './resolveServer';

function appConfig(settings?: Record<string, unknown>): Response {
	return new Response(JSON.stringify({
		data: {
			servers: [{ id: 's1', serverBaseUrl: 'https://server.example.invalid' }],
			settings,
		},
	}), { status: 200 });
}

describe('resolveServerFromAppConfig', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('carries the account\'s synced subtitle and audio language', async () => {
		// The shape app_config sends: each synced setting wrapped with its change time.
		vi.stubGlobal('fetch', vi.fn(async () => appConfig({
			defaultSubtitleLanguage: { value: 'eng', updatedAt: 1700000000000 },
			defaultAudioLanguage: { value: 'jpn', updatedAt: 1700000000000 },
		})));
		const server = await resolveServerFromAppConfig('token');
		expect(server?.defaultSubtitleLanguage).toBe('eng');
		expect(server?.defaultAudioLanguage).toBe('jpn');
	});

	it('reads no language from an empty or missing setting', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => appConfig({ defaultSubtitleLanguage: { value: null, updatedAt: 1700000000000 } })));
		const server = await resolveServerFromAppConfig('token');
		expect(server?.serverId).toBe('s1');
		expect(server?.defaultSubtitleLanguage).toBeNull();
		expect(server?.defaultAudioLanguage).toBeNull();
	});
});
