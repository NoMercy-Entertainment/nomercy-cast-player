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

// Placeholder ids and hosts. KMP: ServerSelectionLogic.kt:94-108 (cast server), :110-125 (selection).
const servers = [
	{
		id: 'server-a',
		serverBaseUrl: 'https://a.example.invalid',
		is_owner: false,
	},
	{
		id: 'server-b',
		serverBaseUrl: 'https://b.example.invalid',
		is_owner: true,
	},
];

function route(down: string[]) {
	return vi.fn(async (url: string) => {
		if (url.includes('/v1/app_config'))
			return new Response(JSON.stringify({ data: { servers } }), { status: 200 });

		if (down.some((host) => url.includes(host)))
			throw new TypeError('unreachable');

		return new Response('{}', { status: 401 });
	});
}

describe('resolveServerFromAppConfig server choice', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('prefers the account\'s own server when the cast names none', async () => {
		vi.stubGlobal('fetch', route([]));
		expect((await resolveServerFromAppConfig('token'))?.serverId).toBe('server-b');
	});

	it('keeps the server the cast names, even when it does not answer', async () => {
		vi.stubGlobal('fetch', route(['a.example.invalid']));
		expect((await resolveServerFromAppConfig('token', { server_id: 'server-a' }))?.serverId).toBe('server-a');
	});

	it('refuses a server id the account does not have', async () => {
		vi.stubGlobal('fetch', route([]));
		expect(await resolveServerFromAppConfig('token', { server_id: 'server-x' })).toBeNull();
	});
});
