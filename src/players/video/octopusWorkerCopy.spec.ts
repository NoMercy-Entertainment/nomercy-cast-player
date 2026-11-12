/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigFromFile } from 'vite';
import type { Plugin } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';

import { OCTOPUS_FILES } from '../../../scripts/copyOctopusWorker.mjs';

const root = process.cwd();
const published = join(root, 'public', 'js', 'octopus');

// Bundling vite.config.ts costs seconds on a loaded runner, so it happens once.
let cached: Plugin | undefined;
beforeAll(async () => {
	const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, join(root, 'vite.config.ts'), root);
	cached = flatten(loaded?.config.plugins ?? []).find(plugin => plugin.name === 'octopus-worker-copy');
}, 60_000);

async function octopusPlugin(): Promise<Plugin | undefined> {
	return cached;
}

function flatten(list: readonly unknown[]): Plugin[] {
	const out: Plugin[] = [];
	for (const entry of list) {
		if (Array.isArray(entry))
			out.push(...flatten(entry));
		else if (entry && typeof entry === 'object')
			out.push(entry as Plugin);
	}
	return out;
}

function runConfigHook(plugin: Plugin, mode: string): void {
	const hook = plugin.config as (config: object, env: { mode: string; command: string }) => void;
	hook({}, { mode, command: 'build' });
}

describe('the octopus worker copy step', () => {
	it('puts the four 0.2.x worker files in public when a production vite build starts', async () => {
		rmSync(published, { recursive: true, force: true });

		const plugin = await octopusPlugin();
		expect(plugin, 'vite.config.ts registers the octopus-worker-copy plugin').toBeDefined();
		runConfigHook(plugin!, 'production');

		expect(readdirSync(published).sort()).toEqual([...OCTOPUS_FILES].sort());
		expect(readFileSync(join(published, 'nomercy-libass-worker.wasm')).length).toBeGreaterThan(1000);
	});

	it('copies the worker from the subtitle-octopus package, never from the video player package', () => {
		const source = readFileSync(join(root, 'scripts', 'copyOctopusWorker.mjs'), 'utf8');

		expect(source).toContain('nomercy-subtitle-octopus');
		expect(source).not.toContain('nomercy-video-player');
	});

	it('leaves public alone in the test mode, so a spec run copies nothing', async () => {
		rmSync(published, { recursive: true, force: true });

		runConfigHook((await octopusPlugin())!, 'test');

		expect(existsSync(published)).toBe(false);
	});
});
