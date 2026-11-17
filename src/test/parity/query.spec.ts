import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/vue-query';
import { defaultQueryClientOptions } from '@/queries/client';
import { queryConfigs } from '@/queries/configs';
import { QueryKeys } from '@/queries/keys';
import { createForegroundWatch, invalidateAfterPlayback, mapServerKey, registerQueryClientGetter } from '@/lib/queryShim';

describe('query layer matches QueryClient.kt', () => {
	it('cfg.homeContent: 5 / 10 min, no refetch on mount (:1291-1305)', () => {
		expect(queryConfigs.homeContent).toEqual({
			staleTime: 300_000,
			gcTime: 600_000,
			refetchOnMount: false,
		});
	});

	it('default.retry: no retry (:104-110)', () => {
		expect(defaultQueryClientOptions.defaultOptions.queries.retry).toBe(0);
	});

	it('q.server-info: key [dashboard, server, info] (:2048)', () => {
		expect([...QueryKeys.serverInfo()]).toEqual(['dashboard', 'server', 'info']);
	});

	it('trig.serverKeyMapping: base prefix dropped, per-title keys mapped (:667-699)', () => {
		expect(mapServerKey(['base', 'libraries'])).toEqual([['libraries']]);
		expect(mapServerKey(['base', 'home'])).toEqual([['home']]);
		expect(mapServerKey(['base', 'music', 'start'])).toEqual([['music', 'start']]);
		expect(mapServerKey(['movie', '1'])).toEqual([['info', 'movie', '1']]);
	});

	it('trig.foreground: refresh only after 10 s away, sweep on every foreground (NoMercyApplication.kt:760-787)', () => {
		let now = 0;
		const refresh = vi.fn();
		const sweep = vi.fn();
		const watch = createForegroundWatch(refresh, sweep, () => now);

		watch.hidden();
		now = 9_999;
		watch.visible();
		expect(refresh).not.toHaveBeenCalled();
		expect(sweep).toHaveBeenCalledTimes(1);
		watch.hidden();
		now += 10_000;
		watch.visible();
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(sweep).toHaveBeenCalledTimes(2);
	});

	it('trig.leavePlayer: exact home and libraries, only after playback (WatchScreen.kt:705-716)', () => {
		const client = new QueryClient();
		const spy = vi.spyOn(client, 'invalidateQueries');

		registerQueryClientGetter(() => client);
		invalidateAfterPlayback(false);
		expect(spy).not.toHaveBeenCalled();
		invalidateAfterPlayback(true);

		expect(spy.mock.calls.map((c) => c[0])).toEqual([
			{
				queryKey: ['home'],
				exact: true,
				refetchType: 'all',
			},
			{
				queryKey: ['libraries'],
				exact: true,
				refetchType: 'all',
			},
		]);
	});

	it('the person and server-info queries use the standard times, home uses homeContent', async () => {
		const read = async (file: string): Promise<string> => (await import('node:fs')).readFileSync(`${process.cwd()}/src/queries/${file}`, 'utf8');

		expect(await read('usePersonQuery.ts')).toContain('...queryConfigs.standard');
		expect(await read('useServerInfoQuery.ts')).toContain('...queryConfigs.standard');
		expect(await read('useHomeQuery.ts')).toContain('...queryConfigs.homeContent');
	});
});
