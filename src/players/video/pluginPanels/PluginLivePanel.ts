/**
 * PluginLivePanel — the live band on the receiver: which channel is playing,
 * what that channel offers, and the number the viewer is typing on the remote.
 *
 * DOM-driven like every other panel here, mounted once per live session and
 * updated in place through the handle it returns.
 *
 * The television is five meters away and the sender is not looking at it, so an
 * action a channel does not offer says so on this screen rather than nowhere.
 */

import type { PluginRefusal } from '@/lib/plugin/refusal';

import type { LiveChannel, LiveController } from '@/lib/plugin/live';

import { numberBuffer, supportedActions } from '@/lib/plugin/live';

export interface PluginLivePanelOptions {
	parent: HTMLElement;
	controller: LiveController;
	/** How long the panel waits before it acts on typed digits. */
	numberWaitMs?: number;
	onRefusal?: (refusal: PluginRefusal) => void;
}

export interface PluginLivePanelHandle {
	press: (digit: string) => void;
	run: (action: string) => void;
	/** Redraws from the controller, after the channel changed for any reason. */
	refresh: () => void;
	setVisible: (visible: boolean) => void;
	dispose: () => void;
}

const LABELS: Record<string, string> = {
	'channel-up': 'Channel up',
	'channel-down': 'Channel down',
	'channel-number': 'Channel number',
	'last-channel': 'Last channel',
	'mini-guide': 'Mini guide',
	'jump-to-live': 'Jump to live',
	'start-over': 'Start over',
	'record': 'Record',
	'quality': 'Quality',
};

export function mountPluginLivePanel(opts: PluginLivePanelOptions): PluginLivePanelHandle {
	const root: HTMLDivElement = document.createElement('div');
	root.className = 'panel plugin-live is-visible';
	root.setAttribute('role', 'group');

	const heading: HTMLParagraphElement = document.createElement('p');
	heading.className = 'live-channel';

	const actions: HTMLUListElement = document.createElement('ul');
	actions.className = 'live-actions';

	const digits: HTMLParagraphElement = document.createElement('p');
	digits.className = 'live-digits';
	digits.hidden = true;

	const notice: HTMLParagraphElement = document.createElement('p');
	notice.className = 'live-notice';
	notice.setAttribute('role', 'status');
	notice.hidden = true;

	root.append(heading, actions, digits, notice);
	opts.parent.append(root);

	function report(refusal: PluginRefusal | null): void {
		notice.hidden = refusal === null;
		notice.textContent = refusal ? refusal.what : '';

		if (refusal)
			opts.onRefusal?.(refusal);
	}

	const buffer = numberBuffer((number: number) => {
		digits.hidden = true;
		digits.textContent = '';
		report(opts.controller.byNumber(number));
		draw();
	}, opts.numberWaitMs ?? 2000);

	function draw(): void {
		const channel: LiveChannel = opts.controller.current();

		heading.textContent = `${channel.number} ${channel.name}`;
		root.setAttribute('aria-label', `Live controls for ${channel.name}`);
		actions.replaceChildren();

		for (const action of supportedActions(channel)) {
			const item: HTMLLIElement = document.createElement('li');
			const button: HTMLButtonElement = document.createElement('button');

			button.type = 'button';
			button.dataset.liveAction = action;
			button.dataset.focusable = '';
			button.tabIndex = 0;
			button.textContent = LABELS[action] ?? action;
			button.addEventListener('click', () => handle(action));

			item.append(button);
			actions.append(item);
		}
	}

	function handle(action: string): void {
		report(opts.controller.run(action));
		draw();
	}

	draw();

	return {
		press(digit: string): void {
			buffer.press(digit);
			digits.textContent = buffer.pending();
			digits.hidden = digits.textContent.length === 0;
		},
		run: handle,
		refresh: draw,
		setVisible(visible: boolean): void {
			root.classList.toggle('is-visible', visible);
		},
		dispose(): void {
			buffer.cancel();
			root.remove();
		},
	};
}
