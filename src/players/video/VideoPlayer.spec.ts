import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import VideoPlayer from './VideoPlayer.vue';

vi.mock('@nomercy-entertainment/nomercy-video-player', () => ({
	default: () => {
		throw new Error('factory boom');
	},
}));

describe('the watch screen tells the user when the player cannot start', () => {
	it('emits an error instead of leaving a silent black box when init throws', async () => {
		const wrapper = mount(VideoPlayer, {
			props: { type: 'movie', id: '1' },
		});

		await flushPromises();

		expect(wrapper.emitted('error')).toBeTruthy();
	});
});
