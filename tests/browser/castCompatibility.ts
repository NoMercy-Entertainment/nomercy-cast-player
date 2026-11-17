// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import '../../src/lib/chrome92Polyfills';
import createPlayer, { OctopusPlugin } from '@nomercy-entertainment/nomercy-video-player';
import { SubtitleOverlayPlugin } from '@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay';
import { TvUiPlugin } from '../../src/players/video/plugins/tv-ui';
import { attachAssPlainTextFallback } from '../../src/players/video/assPlainTextFallback';
import '../../src/styles/tailwind.css';

async function pluginRegistration() {
	const host = document.createElement('div');
	host.id = 'cast-plugin-proof';
	document.body.append(host);
	const player = createPlayer(host.id);
	const errors: string[] = [];
	const settled = new Promise<void>((resolve) => {
		let count = 0;
		const done = () => {
			if (++count === 3)
				resolve();
		};
		player.on('plugin:installed', done);
		player.on('plugin:failed', (event) => {
			errors.push(event.error.stack ?? event.error.message);
			done();
		});
		setTimeout(resolve, 3000);
	});
	player.addPlugin(SubtitleOverlayPlugin);
	player.addPlugin(OctopusPlugin, {
		workerUrl: '/js/octopus/nomercy-libass-worker.js',
		fallbackFont: '/js/octopus/default.ttf',
	});
	player.addPlugin(TvUiPlugin, { onExit: () => {} });
	player.setup({ playlist: [], autoPlay: false });
	await settled;
	const result = {
		subtitleOverlay: Boolean(player.getPlugin(SubtitleOverlayPlugin)),
		octopus: Boolean(player.getPlugin(OctopusPlugin)),
		tvUi: Boolean(player.getPlugin(TvUiPlugin)),
		errors,
	};
	await player.dispose();
	host.remove();
	return result;
}

async function subtitleFallback(mode: 'warning' | 'timeout') {
	const container = document.createElement('div');
	document.body.append(container);
	const handlers = new Map<string, ((data?: unknown) => void)[]>();
	let position = 2;
	const player = {
		container,
		on: (event: string, handler: (data?: unknown) => void) => {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		off: (event: string, handler: (data?: unknown) => void) => {
			handlers.set(event, (handlers.get(event) ?? []).filter(value => value !== handler));
		},
		subtitles: () => [{ url: '/fixture.ass' }],
		time: () => position,
	};
	const emit = (event: string, data?: unknown) => {
		for (const handler of handlers.get(event) ?? [])
			handler(data);
	};
	const detach = attachAssPlainTextFallback(player as never, {
		fetchText: async () => 'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\b1}Readable subtitle\\NSecond line',
		timeoutMs: 20,
	});
	emit('subtitle', { track: 0 });
	// The shipped WASM is probed below. Exercise the same warning path its loader uses.
	if (mode === 'warning')
		emit('plugin:warning', { error: { code: 'plugin:octopus/load-failed' } });
	await new Promise(resolve => setTimeout(resolve, 40));
	const text = container.querySelector('.ass-plain-text')?.textContent;
	position = 4;
	emit('time');
	const cleared = container.querySelector('.ass-plain-text')?.textContent === '';
	detach();
	const detached = container.children.length === 0;
	container.remove();
	return { text, cleared, detached };
}

async function runCastCompatibilityProof() {
	const plugins = await pluginRegistration();
	const fallback = await subtitleFallback('warning');
	const timeoutFallback = await subtitleFallback('timeout');
	const response = await fetch('/js/octopus/nomercy-libass-worker.wasm');
	const bytes = await response.arrayBuffer();
	const wasm = { bytes: bytes.byteLength, valid: WebAssembly.validate(bytes) };
	const passed = plugins.subtitleOverlay && plugins.octopus && plugins.tvUi
		&& plugins.errors.length === 0
		&& fallback.text === 'Readable subtitle\nSecond line' && fallback.cleared && fallback.detached
		&& timeoutFallback.text === fallback.text && timeoutFallback.cleared && timeoutFallback.detached;
	return { userAgent: navigator.userAgent, plugins, fallback, timeoutFallback, wasm, passed };
}

Reflect.set(globalThis, 'runCastCompatibilityProof', runCastCompatibilityProof);
