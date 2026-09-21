import { describe, expect, it } from 'vitest';

import type { GuideChannel, GuideProgramme, GuideWindow } from './epg';

import { layoutGuide, nowOffset, windowMinutes } from './epg';

const window: GuideWindow = {
	from: new Date('2026-09-16T20:00:00Z'),
	to: new Date('2026-09-16T22:00:00Z'),
};

const channels: GuideChannel[] = [{ channelId: 'a', number: 1, name: 'One' }];

const programmes: GuideProgramme[] = [
	{ programmeId: 'p2', channelId: 'a', title: 'Film', start: '2026-09-16T20:30:00Z', stop: '2026-09-16T23:00:00Z' },
	{ programmeId: 'p1', channelId: 'a', title: 'News', start: '2026-09-16T19:30:00Z', stop: '2026-09-16T20:30:00Z' },
	{ programmeId: 'p3', channelId: 'b', title: 'Other', start: '2026-09-16T20:00:00Z', stop: '2026-09-16T21:00:00Z' },
	{ programmeId: 'p0', channelId: 'a', title: 'Yesterday', start: '2026-09-15T20:00:00Z', stop: '2026-09-15T21:00:00Z' },
];

describe('the guide grid', () => {
	it('gives one row per channel, in number order', () => {
		const rows = layoutGuide(
			[{ channelId: 'z', number: 9, name: 'Nine' }, ...channels],
			programmes,
			window,
		);

		expect(rows.map(row => row.channelId)).toEqual(['a', 'z']);
	});

	it('clips a programme that started before the window to the window edge', () => {
		const [row] = layoutGuide(channels, programmes, window);

		expect(row?.items[0]).toMatchObject({
			programmeId: 'p1',
			offsetMinutes: 0,
			widthMinutes: 30,
			clippedStart: true,
			clippedStop: false,
		});
	});

	it('clips a programme that runs past the window to the window edge', () => {
		const [row] = layoutGuide(channels, programmes, window);

		expect(row?.items[1]).toMatchObject({
			programmeId: 'p2',
			offsetMinutes: 30,
			widthMinutes: 90,
			clippedStart: false,
			clippedStop: true,
		});
	});

	it('orders a channel row by the clock, not by the order the guide arrived', () => {
		const [row] = layoutGuide(channels, programmes, window);

		expect(row?.items.map(item => item.programmeId)).toEqual(['p1', 'p2']);
	});

	it('drops a programme belonging to a channel that is not in the grid', () => {
		const [row] = layoutGuide(channels, programmes, window);

		expect(row?.items.map(item => item.programmeId)).not.toContain('p3');
	});

	it('drops a programme that is outside the window entirely', () => {
		const [row] = layoutGuide(channels, programmes, window);

		expect(row?.items.map(item => item.programmeId)).not.toContain('p0');
	});

	it('leaves a channel with nothing scheduled as an empty row rather than no row', () => {
		const rows = layoutGuide(
			[...channels, { channelId: 'c', number: 2, name: 'Two' }],
			programmes,
			window,
		);

		expect(rows).toHaveLength(2);
		expect(rows[1]?.items).toEqual([]);
	});

	it('puts the now line where the clock is inside the window', () => {
		expect(nowOffset(window, new Date('2026-09-16T20:45:00Z'))).toBe(45);
	});

	it('draws no now line when the clock is outside the window', () => {
		expect(nowOffset(window, new Date('2026-09-16T19:00:00Z'))).toBeNull();
		expect(nowOffset(window, new Date('2026-09-16T23:00:00Z'))).toBeNull();
	});

	it('measures the window itself, which is what the widths are drawn against', () => {
		expect(windowMinutes(window)).toBe(120);
	});
});
