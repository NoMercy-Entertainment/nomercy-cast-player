export interface GuideChannel {
	channelId: string;
	number: number;
	name: string;
}

export interface GuideProgramme {
	programmeId: string;
	channelId: string;
	title: string;
	start: string;
	stop: string;
}

export interface GuideWindow {
	from: Date;
	to: Date;
}

export interface GuideItem {
	programmeId: string;
	title: string;
	offsetMinutes: number;
	widthMinutes: number;
	/** It began before this window, so the grid draws no left edge on it. */
	clippedStart: boolean;
	/** It ends after this window, so the grid draws no right edge on it. */
	clippedStop: boolean;
}

export interface GuideRow {
	channelId: string;
	number: number;
	name: string;
	items: GuideItem[];
}

function minutes(from: Date, to: Date): number {
	return Math.round((to.getTime() - from.getTime()) / 60000);
}

/**
 * One row per channel, always, and every programme measured against the window.
 *
 * A guide that only emits rows for channels with data leaves holes where a
 * provider sent nothing, and the row under the hole then reads as the wrong
 * channel's schedule.
 */
export function layoutGuide(
	channels: GuideChannel[],
	programmes: GuideProgramme[],
	window: GuideWindow,
): GuideRow[] {
	const span: number = minutes(window.from, window.to);

	return [...channels]
		.sort((a, b) => a.number - b.number)
		.map((channel) => {
			const items: GuideItem[] = programmes
				.filter(one => one.channelId === channel.channelId)
				.map(one => ({ one, start: new Date(one.start), stop: new Date(one.stop) }))
				.filter(({ start, stop }) => stop > window.from && start < window.to)
				.sort((a, b) => a.start.getTime() - b.start.getTime())
				.map(({ one, start, stop }) => {
					const offset: number = Math.max(0, minutes(window.from, start));
					const end: number = Math.min(span, minutes(window.from, stop));

					return {
						programmeId: one.programmeId,
						title: one.title,
						offsetMinutes: offset,
						widthMinutes: end - offset,
						clippedStart: start < window.from,
						clippedStop: stop > window.to,
					};
				});

			return {
				channelId: channel.channelId,
				number: channel.number,
				name: channel.name,
				items,
			};
		});
}

/** Where the clock falls inside the window, or null when the window is elsewhere. */
export function nowOffset(window: GuideWindow, now: Date): number | null {
	if (now < window.from || now > window.to)
		return null;

	return minutes(window.from, now);
}

/** The whole window in minutes, which is what a row's widths are drawn against. */
export function windowMinutes(window: GuideWindow): number {
	return minutes(window.from, window.to);
}
