import { describe, expect, it, vi } from 'vitest';

import type { LiveChannel } from './live';

import { PluginLiveAction } from '@/types/pluginVocabulary';
import { createLiveController, numberBuffer, supportedActions } from './live';

// Deliberately not in number order: the guide arrives in whatever order the
// provider wrote it, and channel up has to follow the numbers.
const channels: LiveChannel[] = [
	{
		channelId: 'a',
		number: 1,
		name: 'One',
		group: 'General',
		adult: false,
		catchUp: true,
		startOver: true,
		record: false,
		qualities: ['auto', '720p'],
	},
	{
		channelId: 'b',
		number: 101,
		name: 'Hundred One',
		group: 'Sport',
		adult: false,
		catchUp: false,
		startOver: false,
		record: false,
		qualities: [],
	},
	{
		channelId: 'c',
		number: 50,
		name: 'Fifty',
		group: 'News',
		adult: false,
		catchUp: false,
		startOver: false,
		record: true,
		qualities: ['auto'],
	},
];

describe('a live channel, from any client', () => {
	it('lists only the actions this channel offers', () => {
		expect(supportedActions(channels[1]!)).toEqual([
			PluginLiveAction.ChannelUp,
			PluginLiveAction.ChannelDown,
			PluginLiveAction.ChannelNumber,
			PluginLiveAction.LastChannel,
			PluginLiveAction.MiniGuide,
			PluginLiveAction.JumpToLive,
		]);
	});

	it('adds start over, record and quality only where the channel declares them', () => {
		const actions: string[] = supportedActions(channels[0]!);

		expect(actions).toContain(PluginLiveAction.StartOver);
		expect(actions).toContain(PluginLiveAction.Quality);
		expect(actions).not.toContain(PluginLiveAction.Record);
	});

	it('refuses an action the channel does not offer, and says which', () => {
		const controller = createLiveController({ channels, current: 'b', play: vi.fn() });
		const refusal = controller.run(PluginLiveAction.Record);

		expect(refusal?.code).toBe('PLUGIN_LIVE_UNSUPPORTED');
		expect(refusal?.what).toContain('record');
		expect(refusal?.what).toContain('Hundred One');
		expect(refusal?.severity).toBe('degraded');
	});

	it('walks channel up in number order, not in the order the list arrived', () => {
		const play = vi.fn();
		const controller = createLiveController({ channels, current: 'a', play });

		controller.run(PluginLiveAction.ChannelUp);

		expect(play).toHaveBeenCalledWith('c');
	});

	it('wraps at the end, and wraps at the start too', () => {
		const play = vi.fn();
		const up = createLiveController({ channels, current: 'b', play });

		up.run(PluginLiveAction.ChannelUp);
		expect(play).toHaveBeenLastCalledWith('a');

		const down = createLiveController({ channels, current: 'a', play });

		down.run(PluginLiveAction.ChannelDown);
		expect(play).toHaveBeenLastCalledWith('b');
	});

	it('walks channel down in number order', () => {
		const play = vi.fn();
		const controller = createLiveController({ channels, current: 'c', play });

		controller.run(PluginLiveAction.ChannelDown);

		expect(play).toHaveBeenCalledWith('a');
		expect(controller.current().channelId).toBe('a');
	});

	it('returns to the channel it came from', () => {
		const play = vi.fn();
		const controller = createLiveController({ channels, current: 'a', play });

		controller.run(PluginLiveAction.ChannelUp);
		controller.run(PluginLiveAction.LastChannel);

		expect(play).toHaveBeenLastCalledWith('a');
	});

	it('plays the channel whose number was typed, not the nearest one', () => {
		const play = vi.fn();
		const controller = createLiveController({ channels, current: 'a', play });

		expect(controller.byNumber(101)).toBeNull();
		expect(play).toHaveBeenCalledWith('b');
	});

	it('refuses a number nobody broadcasts on', () => {
		const play = vi.fn();
		const controller = createLiveController({ channels, current: 'a', play });
		const refusal = controller.byNumber(77);

		expect(refusal?.code).toBe('PLUGIN_LIVE_UNSUPPORTED');
		expect(refusal?.what).toContain('77');
		expect(play).not.toHaveBeenCalled();
	});

	it('buffers digits so 1 0 1 reaches channel 101', () => {
		vi.useFakeTimers();
		const commit = vi.fn();
		const buffer = numberBuffer(commit, 2000);

		buffer.press('1');
		buffer.press('0');
		buffer.press('1');

		// Still nothing a second and a half later: a player that acted on the
		// first digit sent the viewer to channel 1 and then to channel 0.
		vi.advanceTimersByTime(1500);
		expect(commit).not.toHaveBeenCalled();

		vi.advanceTimersByTime(500);
		expect(commit).toHaveBeenCalledWith(101);
		vi.useRealTimers();
	});

	it('starts a fresh number after it commits', () => {
		vi.useFakeTimers();
		const commit = vi.fn();
		const buffer = numberBuffer(commit, 2000);

		buffer.press('1');
		vi.advanceTimersByTime(2000);
		buffer.press('2');
		vi.advanceTimersByTime(2000);

		expect(commit).toHaveBeenNthCalledWith(1, 1);
		expect(commit).toHaveBeenNthCalledWith(2, 2);
		vi.useRealTimers();
	});

	it('shows what has been typed while the viewer is still typing', () => {
		vi.useFakeTimers();
		const buffer = numberBuffer(vi.fn(), 2000);

		buffer.press('1');
		buffer.press('0');

		expect(buffer.pending()).toBe('10');
		buffer.cancel();
		expect(buffer.pending()).toBe('');
		vi.useRealTimers();
	});
});
