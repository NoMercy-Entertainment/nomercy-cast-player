import { describe, expect, it } from 'vitest';

import type { PluginMediaRef } from './mediaRef';

import { carriesToken, toFrameItem } from './mediaRef';

const audio: PluginMediaRef = {
	pluginId: 'radio',
	mediaId: 'npo3fm',
	kind: 'audio',
	live: true,
	url: 'https://server.test/api/v1/plugins/radio/proxy/npo3fm',
	title: 'NPO 3FM',
	artist: 'Radio',
	cover: 'https://server.test/cover.jpg',
};

describe('a plugin media reference on the receiver', () => {
	it('becomes a frame item keyed on the plugin and its own media id', () => {
		expect(toFrameItem(audio)?.id).toBe('plugin:radio:npo3fm');
	});

	it('carries the title, the cover and whether it ends', () => {
		const item = toFrameItem(audio);

		expect(item?.name).toBe('NPO 3FM');
		expect(item?.cover).toBe('https://server.test/cover.jpg');
		expect(item?.live).toBe(true);
	});

	it('plays from the url the host minted, unchanged', () => {
		expect(toFrameItem(audio)?.path).toBe(audio.url);
	});

	// A token in a url is a credential in a log and on a screen four metres
	// wide, where anyone in the room can read it.
	it('refuses a url that carries a token', () => {
		expect(toFrameItem({ ...audio, url: 'https://upstream.test/s?token=abc' })).toBeNull();
	});

	it('refuses every name a credential travels under', () => {
		for (const name of ['token', 'key', 'auth', 'signature', 'sig', 'password', 'access_token', 'api_key'])
			expect(carriesToken(`https://x.test/s?${name}=abc`)).toBe(true);
	});

	// A long opaque path segment is an id, and refusing those would refuse
	// every real media url the host mints.
	it('accepts a host minted url whose path merely looks opaque', () => {
		expect(carriesToken('https://server.test/api/v1/plugins/radio/proxy/01J9ZK5V8Y')).toBe(false);
	});

	it('accepts a url whose query names something that is not a credential', () => {
		expect(carriesToken('https://server.test/s?bitrate=128')).toBe(false);
	});

	it('carries no cover when the plugin sent none', () => {
		expect(toFrameItem({ ...audio, cover: null })?.cover).toBeNull();
	});
});
