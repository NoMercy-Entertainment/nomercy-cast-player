import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';

import AppSettingsScreen from '@/views/profile/AppSettingsScreen.vue';

const { state, hasPending, lastError, pending } = await vi.hoisted(async () => {
	// vi.mock is hoisted above the file, so the refs it closes over have to be
	// created up here with it.
	const { ref: makeRef } = await import('vue');
	return {
		state: makeRef('idle'),
		hasPending: makeRef(true),
		lastError: makeRef(null as string | null),
		pending: makeRef({ body: 'app 1.0' } as { body: string } | null),
	};
});

vi.mock('@/lib/diagnostics/sender', () => ({
	diagnosticsSender: {
		state,
		pending,
		previewText: ref('app 1.0\ndevice Chromecast'),
		hasPending,
		lastError,
		lastReportId: ref('01a0bc49'),
		prepare: vi.fn(),
		discard: vi.fn(),
		confirmSend: vi.fn(),
	},
}));

function screen(): string {
	return mount(AppSettingsScreen, { global: { stubs: { RouterLink: true, teleport: true } } }).text();
}

/**
 * The real screen, rendered. A hand-written copy of its conditions would pass
 * whatever the file says, which is the failure these exist to catch.
 */
describe('the diagnostics rows on the settings screen', () => {
	beforeEach(() => {
		state.value = 'idle';
		hasPending.value = true;
		lastError.value = null;
		pending.value = { body: 'app 1.0' };
	});

	it('offers the send and a cancel while nothing has gone yet', () => {
		const text = screen();

		expect(text).toContain('Send this report now');
		expect(text).toContain('Cancel');
		expect(text).not.toContain('Close');
	});

	it('keeps offering the send while it is still sending', () => {
		// The row is disabled here, not removed: removing it makes the list jump
		// under a D-pad cursor that is sitting on it.
		state.value = 'sending';

		expect(screen()).toContain('Send this report now');
	});

	it('offers no send once the report has gone', () => {
		state.value = 'sent';

		expect(screen()).not.toContain('Send this report now');
	});

	it('has nothing left to cancel once the report has gone', () => {
		state.value = 'sent';
		const text = screen();

		expect(text).toContain('Close');
		expect(text).not.toContain('Cancel');
	});

	it('offers the send again after it failed, and says why', () => {
		// A failure must not stand the user down with only a dismiss.
		state.value = 'failed';
		lastError.value = 'Not signed in';
		const text = screen();

		expect(text).toContain('Send this report now');
		expect(text).toContain('Not signed in');
		expect(text).toContain('Cancel');
	});

	it('shows no diagnostics rows at all when nothing is pending', () => {
		hasPending.value = false;
		pending.value = null;
		const text = screen();

		expect(text).not.toContain('Send this report now');
		expect(text).not.toContain('Close');
	});
});
