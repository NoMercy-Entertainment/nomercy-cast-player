import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import PluginEpgGrid from './PluginEpgGrid.vue';

const data = {
	channels: [
		{ channelId: 'b', number: 101, name: 'Hundred One' },
		{ channelId: 'a', number: 1, name: 'One' },
	],
	programmes: [
		{ programmeId: 'p1', channelId: 'a', title: 'News', start: '2026-09-16T19:30:00Z', stop: '2026-09-16T20:30:00Z' },
		{ programmeId: 'p2', channelId: 'a', title: 'Film', start: '2026-09-16T20:30:00Z', stop: '2026-09-16T23:00:00Z' },
	],
	from: '2026-09-16T20:00:00Z',
	to: '2026-09-16T22:00:00Z',
	now: '2026-09-16T20:45:00Z',
};

function grid(over: Partial<typeof data> = {}) {
	return mount(PluginEpgGrid, { props: { id: 'guide', data: { ...data, ...over } } });
}

/**
 * The receiver's guide is read only, and it still has to be readable.
 *
 * The sender drives the television, so nothing here is pressable; what does
 * have to survive is the schedule itself, in the right order, with each
 * programme naming its channel and its times.
 */
describe('the receiver guide grid', () => {
	it('draws the channels in number order', () => {
		const drawn = grid().findAll('tbody tr').map(row => row.attributes('data-channel'));

		expect(drawn).toEqual(['a', 'b']);
	});

	it('presses nothing, because a television has no keyboard', () => {
		expect(grid().findAll('button')).toHaveLength(0);
	});

	it('is a real grid with a header cell per channel', () => {
		const wrapper = grid();

		expect(wrapper.get('table').attributes('role')).toBe('grid');
		expect(wrapper.get('table').attributes('aria-label')).toBe('Guide');
		expect(wrapper.findAll('th[scope="row"]')).toHaveLength(2);
	});

	it('names every programme with its channel and its times', () => {
		const label = grid().get('[data-programme="p1"]').attributes('aria-label') ?? '';

		expect(label).toContain('News');
		expect(label).toContain('One');
	});

	it('draws a clipped programme without the edge it does not have', () => {
		const wrapper = grid();

		expect(wrapper.get('[data-programme="p1"]').classes()).toContain('is-clipped-start');
		expect(wrapper.get('[data-programme="p2"]').classes()).toContain('is-clipped-stop');
	});

	it('sizes a programme against the window it is drawn in', () => {
		const style = grid().get('[data-programme="p2"]').attributes('style') ?? '';

		expect(style).toContain('75%');
		expect(style).toContain('25%');
	});

	it('says so where a channel has nothing scheduled', () => {
		expect(grid().get('[data-channel="b"]').text()).toContain('Nothing scheduled');
	});

	it('puts the now line where the clock is, and nowhere when it is outside', () => {
		expect(grid().get('[data-now-line]').attributes('style')).toContain('37.5%');
		expect(grid({ now: '2026-09-16T10:00:00Z' }).find('[data-now-line]').exists()).toBe(false);
	});
});
