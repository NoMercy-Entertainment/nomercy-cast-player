import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ProfileScreen from './ProfileScreen.vue';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/queries/useMeQuery', () => ({
	useMeQuery: () => ({
		data: ref({ name: 'Jordan', email: 'jordan@example.com' }),
	}),
}));

describe('the profile screen avatar for a user known only by email', () => {
	it('falls back to initials instead of asking a third party for an avatar', () => {
		const wrapper = mount(ProfileScreen, {
			global: { stubs: { SetupBackdrop: true } },
		});

		expect(wrapper.find('img.avatar').exists()).toBe(false);
		expect(wrapper.find('.avatar-fallback').exists()).toBe(true);
	});
});
