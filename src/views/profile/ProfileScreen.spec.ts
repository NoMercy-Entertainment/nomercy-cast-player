import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ProfileScreen from './ProfileScreen.vue';
import { authStore } from '@/stores/authStore';
import { socketStore } from '@/stores/socketStore';

const { push, disconnectAll } = vi.hoisted(() => ({
	push: vi.fn(),
	disconnectAll: vi.fn(),
}));

vi.mock('vue-router', () => ({
	useRouter: () => ({ push }),
}));

vi.mock('@/stores/socketStore', () => ({
	socketStore: { disconnectAll },
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

describe('profile sign-out', () => {
	it('disconnects every hub before clearing auth and navigating away', async () => {
		let finishDisconnect!: () => void;
		disconnectAll.mockImplementationOnce(() => new Promise<void>((resolve) => {
			finishDisconnect = resolve;
		}));
		const clear = vi.spyOn(authStore, 'clear');
		const wrapper = mount(ProfileScreen, {
			global: { stubs: { SetupBackdrop: true } },
		});

		await wrapper.find('.header-card').trigger('click');
		await wrapper.find('.nm-dialog .nm-pill-sm-primary').trigger('click');
		expect(socketStore.disconnectAll).toHaveBeenCalledOnce();
		expect(clear).not.toHaveBeenCalled();
		expect(push).not.toHaveBeenCalled();

		finishDisconnect();
		await vi.waitFor(() => {
			expect(clear).toHaveBeenCalledOnce();
			expect(push).toHaveBeenCalledWith('/splash');
		});
		clear.mockRestore();
	});
});
