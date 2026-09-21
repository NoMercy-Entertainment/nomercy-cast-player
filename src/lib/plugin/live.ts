import type { PluginRefusal } from './refusal';

import { PluginLiveAction } from '@/types/pluginVocabulary';

/**
 * One live channel as a client receives it.
 *
 * It carries no upstream url: the host resolves those server side, which is why
 * a provider credential never reaches a device. What a channel offers is
 * declared rather than assumed, because a player that drew Start over and
 * Record on every channel offered two buttons that did nothing on most of them.
 */
export interface LiveChannel {
	channelId: string;
	number: number;
	name: string;
	group?: string | null;
	adult: boolean;
	catchUp: boolean;
	startOver: boolean;
	record: boolean;
	qualities: string[];
}

/** What every channel offers, because every remote has these buttons. */
const ALWAYS: string[] = [
	PluginLiveAction.ChannelUp,
	PluginLiveAction.ChannelDown,
	PluginLiveAction.ChannelNumber,
	PluginLiveAction.LastChannel,
	PluginLiveAction.MiniGuide,
	PluginLiveAction.JumpToLive,
];

export function supportedActions(channel: LiveChannel): string[] {
	const extra: string[] = [];

	if (channel.startOver)
		extra.push(PluginLiveAction.StartOver);

	if (channel.record)
		extra.push(PluginLiveAction.Record);

	if (channel.qualities.length > 0)
		extra.push(PluginLiveAction.Quality);

	return [...ALWAYS, ...extra];
}

export interface NumberBuffer {
	press: (digit: string) => void;
	/** What has been typed so far, so the player can draw it while the viewer types. */
	pending: () => string;
	cancel: () => void;
}

/**
 * Digits arrive one at a time and 101 is three of them.
 *
 * Committing on the first digit sends the viewer to channel 1 and then to
 * channel 0, which is why every television waits before it acts.
 */
export function numberBuffer(commit: (channel: number) => void, waitMs: number): NumberBuffer {
	let digits = '';
	let timer: ReturnType<typeof setTimeout> | undefined;

	function stop(): void {
		if (timer)
			clearTimeout(timer);

		timer = undefined;
	}

	return {
		press(digit: string): void {
			digits += digit;
			stop();

			timer = setTimeout(() => {
				const typed: string = digits;
				digits = '';
				timer = undefined;
				commit(Number.parseInt(typed, 10));
			}, waitMs);
		},
		pending(): string {
			return digits;
		},
		cancel(): void {
			stop();
			digits = '';
		},
	};
}

export interface LiveController {
	run: (action: string) => PluginRefusal | null;
	/** The channel the player is on, which a control strip draws. */
	current: () => LiveChannel;
	byNumber: (number: number) => PluginRefusal | null;
}

export function createLiveController(options: {
	channels: LiveChannel[];
	current: string;
	play: (channelId: string) => void;
}): LiveController {
	const ordered: LiveChannel[] = [...options.channels].sort((a, b) => a.number - b.number);
	let current: string = options.current;
	let previous: string = options.current;

	function at(): LiveChannel {
		return ordered.find(one => one.channelId === current) as LiveChannel;
	}

	function go(channelId: string): void {
		previous = current;
		current = channelId;
		options.play(channelId);
	}

	function step(by: number): void {
		const index: number = ordered.findIndex(one => one.channelId === current);
		const next: LiveChannel = ordered[(index + by + ordered.length) % ordered.length] as LiveChannel;

		go(next.channelId);
	}

	function unsupported(action: string, channel: LiveChannel): PluginRefusal {
		return {
			code: 'PLUGIN_LIVE_UNSUPPORTED',
			plugin: 'live',
			what: `The player was asked to ${action} on ${channel.name} and this channel does not offer it.`,
			why: 'A live channel declares which actions its provider supports, and this one does not declare that action.',
			fix: 'Offer the action in the live descriptor the plugin publishes, or hide the control for this channel. Docs: /nomercy-plugins/capabilities/media-live',
			severity: 'degraded',
		};
	}

	return {
		current: at,

		run(action: string): PluginRefusal | null {
			const channel: LiveChannel = at();

			if (!supportedActions(channel).includes(action))
				return unsupported(action, channel);

			if (action === PluginLiveAction.ChannelUp)
				step(1);

			if (action === PluginLiveAction.ChannelDown)
				step(-1);

			if (action === PluginLiveAction.LastChannel)
				go(previous);

			return null;
		},

		/**
		 * A number nobody broadcasts on is a typo, not a channel.
		 *
		 * Playing the nearest one instead sent a viewer who typed 101 to channel
		 * 1, which is a different programme on a different station.
		 */
		byNumber(number: number): PluginRefusal | null {
			const channel: LiveChannel | undefined = ordered.find(one => one.number === number);

			if (!channel) {
				return {
					code: 'PLUGIN_LIVE_UNSUPPORTED',
					plugin: 'live',
					what: `The player was asked for channel ${number} and no channel has that number.`,
					why: 'Channel numbers come from the live descriptor the plugin publishes, and none of them is that one.',
					fix: 'Type a number the guide lists, or publish that number in the live descriptor. Docs: /nomercy-plugins/capabilities/media-live',
					severity: 'degraded',
				};
			}

			go(channel.channelId);

			return null;
		},
	};
}
