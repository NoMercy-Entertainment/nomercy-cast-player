import { beforeEach, describe, expect, it, vi } from 'vitest';
import { diagnosticsSender } from './sender';
import { diagnosticsRing } from './sink';
import { DiagnosticsCategory, DiagnosticsCode } from './events';
import { postDiagnosticsReport } from '@/lib/nomercyApi';
import { authStore } from '@/stores/authStore';

vi.mock('@/lib/nomercyApi', () => ({
	postDiagnosticsReport: vi.fn(async () => ({ id: 'report-1' })),
}));

const post = vi.mocked(postDiagnosticsReport);

beforeEach(() => {
	post.mockClear();
	diagnosticsRing.clear();
	diagnosticsSender.discard();
	authStore.accessToken.value = 'token-for-tests';
});

describe('diagnosticsSender', () => {
	it('does not send until the user confirms', async () => {
		diagnosticsRing.record(DiagnosticsCategory.Playback, DiagnosticsCode.SourceRequested);

		const prepared = diagnosticsSender.prepare('manual');

		expect(prepared.kind).toBe('manual');
		expect(diagnosticsSender.pending.value).toEqual(prepared);
		expect(post).not.toHaveBeenCalled();

		await diagnosticsSender.confirmSend();

		expect(post).toHaveBeenCalledTimes(1);
		expect(post.mock.calls[0][1]).toEqual(prepared);
		expect(diagnosticsSender.state.value).toBe('sent');
		expect(diagnosticsSender.pending.value).toBeNull();
	});

	it('sends nothing when there is no prepared report', async () => {
		const sent = await diagnosticsSender.confirmSend();

		expect(sent).toBe(false);
		expect(post).not.toHaveBeenCalled();
	});

	it('sends nothing after the user cancels', async () => {
		diagnosticsSender.prepare('manual');
		diagnosticsSender.discard();

		await diagnosticsSender.confirmSend();

		expect(post).not.toHaveBeenCalled();
	});
});
