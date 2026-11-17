import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveServerFromAppConfig } from './resolveServer';
import { syncedSettings } from './syncedSettings';
import { settingsStore } from '@/stores/settingsStore';

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

	// SyncedSettingsRegistry.kt:60-83 lists 22 keys; SettingsSyncEngine.kt:304-337 applies a valid server value.
	it('applies the account\'s synced settings to the receiver', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => appConfig({
			autoSkipChapters: { value: true, updatedAt: 1 },
			autoThemeColors: { value: false, updatedAt: 1 },
			videoSeekStep: { value: 30, updatedAt: 1 },
			screensaverDelay: { value: 1, updatedAt: 1 },
			colorScheme: { value: 'light', updatedAt: 1 },
		})));

		await resolveServerFromAppConfig('token');

		expect(settingsStore.autoSkipChapters.value).toBe(true);
		expect(settingsStore.useAutoThemeColors.value).toBe(false);
		expect(settingsStore.videoSeekStep.value).toBe(30);
		expect(settingsStore.screensaverDelay.value).toBe(1);
		expect(syncedSettings.value.colorScheme).toBe('light');
	});

	it('skips a synced value outside its range or type, as the native validators do', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => appConfig({
			videoSeekStep: { value: 500, updatedAt: 1 },
			screensaverDelay: { value: 'soon', updatedAt: 1 },
			colorScheme: { value: 'purple', updatedAt: 1 },
		})));

		settingsStore.videoSeekStep.value = 10;
		settingsStore.screensaverDelay.value = 5;

		await resolveServerFromAppConfig('token');

		expect(settingsStore.videoSeekStep.value).toBe(10);
		expect(settingsStore.screensaverDelay.value).toBe(5);
		expect(syncedSettings.value.colorScheme).toBeUndefined();
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
