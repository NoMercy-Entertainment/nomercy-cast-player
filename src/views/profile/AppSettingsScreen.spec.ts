import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import AppSettingsScreen from '@/views/profile/AppSettingsScreen.vue';

vi.mock('@/lib/diagnostics/sender', async () => {
	const { ref } = await import('vue');
	return {
		diagnosticsSender: {
			state: ref('sent'),
			pending: ref({ body: 'app 1.0' }),
			previewText: ref('app 1.0'),
			hasPending: ref(true),
			lastError: ref(null),
			lastReportId: ref('01a0bc49'),
			prepare: vi.fn(),
			discard: vi.fn(),
			confirmSend: vi.fn(),
		},
	};
});

/**
 * The real screen, rendered. A hand-written copy of its conditions would pass
 * whatever the file says, which is the failure this test exists to catch.
 */
describe('the diagnostics rows on the settings screen', () => {
	it('offers nothing to send and nothing to cancel once the report has gone', () => {
		const wrapper = mount(AppSettingsScreen, {
			global: { stubs: { RouterLink: true, teleport: true } },
		});
		const text = wrapper.text();

		expect(text).not.toContain('Send this report now');
		expect(text).toContain('Close');
		expect(text).not.toContain('Cancel');
	});
});
