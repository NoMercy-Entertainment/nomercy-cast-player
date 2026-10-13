import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ProfileChip from './ProfileChip.vue';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/queries/useMeQuery', () => ({
	useMeQuery: () => ({
		data: ref({ name: 'Jordan', email: 'jordan@example.com' }),
	}),
}));

describe('the profile chip avatar for a user known only by email', () => {
	it('falls back to initials instead of asking a third party for an avatar', () => {
		const wrapper = mount(ProfileChip);

		expect(wrapper.find('img.avatar').exists()).toBe(false);
		expect(wrapper.find('.initials').text()).toBe('J');
	});
});
