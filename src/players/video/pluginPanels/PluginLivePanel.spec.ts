import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveChannel } from '@/lib/plugin/live';

import { createLiveController } from '@/lib/plugin/live';
import { mountPluginLivePanel } from './PluginLivePanel';

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
		qualities: ['auto'],
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
];

function panel(current: string) {
	const parent = document.createElement('div');
	const play = vi.fn();
	const onRefusal = vi.fn();
	const controller = createLiveController({ channels, current, play });

	document.body.append(parent);

	return {
		parent,
		play,
		onRefusal,
		handle: mountPluginLivePanel({ parent, controller, onRefusal }),
	};
}

beforeEach(() => {
	document.body.replaceChildren();
});

/**
 * The band the television draws while a plugin's channel is playing.
 *
 * The sender is not looking at this screen, so a refusal has to appear here:
 * before it did, pressing Record on a channel that has none did nothing at all
 * and the room concluded the receiver had frozen.
 */
describe('the live panel', () => {
	it('names the channel it is playing, number included', () => {
		const { parent } = panel('b');

		expect(parent.querySelector('.live-channel')?.textContent).toBe('101 Hundred One');
	});

	it('draws a control for every action the channel offers, and no others', () => {
		const { parent } = panel('b');
		const drawn = Array.from(parent.querySelectorAll('[data-live-action]'))
			.map(one => (one as HTMLElement).dataset.liveAction);

		expect(drawn).toContain('channel-up');
		expect(drawn).not.toContain('start-over');
		expect(drawn).not.toContain('quality');
	});

	it('offers start over and quality where the channel declares them', () => {
		const { parent } = panel('a');
		const drawn = Array.from(parent.querySelectorAll('[data-live-action]'))
			.map(one => (one as HTMLElement).dataset.liveAction);

		expect(drawn).toContain('start-over');
		expect(drawn).toContain('quality');
	});

	it('changes channel when a control is pressed, and redraws for the new one', () => {
		const { parent, play } = panel('b');

		parent.querySelector<HTMLButtonElement>('[data-live-action="channel-up"]')?.click();

		expect(play).toHaveBeenCalledWith('a');
		expect(parent.querySelector('.live-channel')?.textContent).toBe('1 One');
	});

	it('shows the number while it is being typed, then plays it', () => {
		vi.useFakeTimers();
		const { parent, handle, play } = panel('a');

		handle.press('1');
		handle.press('0');
		handle.press('1');

		expect(parent.querySelector('.live-digits')?.textContent).toBe('101');
		expect(play).not.toHaveBeenCalled();

		vi.advanceTimersByTime(2000);

		expect(play).toHaveBeenCalledWith('b');
		expect((parent.querySelector('.live-digits') as HTMLElement).hidden).toBe(true);
		vi.useRealTimers();
	});

	it('says on the screen why an action was refused', () => {
		const { parent, onRefusal, handle } = panel('b');

		handle.run('record');

		const notice = parent.querySelector('.live-notice') as HTMLElement;

		expect(notice.hidden).toBe(false);
		expect(notice.textContent).toContain('Hundred One');
		expect(onRefusal).toHaveBeenCalledWith(
			expect.objectContaining({ code: 'PLUGIN_LIVE_UNSUPPORTED' }),
		);
	});

	it('takes itself off the screen when it is disposed', () => {
		const { parent, handle } = panel('a');

		handle.dispose();

		expect(parent.querySelector('.plugin-live')).toBeNull();
	});
});
