import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { videoSyncBridge } from './syncBridge';

const { finishImport, importPending, importStarted, startImport, setup, overlayAttach }
	= vi.hoisted(() => {
		let finishImport!: () => void;
		let startImport!: () => void;
		const importPending = new Promise<void>((resolve) => {
			finishImport = resolve;
		});
		const importStarted = new Promise<void>((resolve) => {
			startImport = resolve;
		});
		return {
			finishImport,
			importPending,
			importStarted,
			startImport,
			setup: vi.fn(() => ({})),
			overlayAttach: vi.fn(),
		};
	});

vi.mock('@nomercy-entertainment/nomercy-video-player', async () => {
	startImport();
	await importPending;
	return { default: () => ({ setup }) };
});

vi.mock('./TVOverlayPlugin', () => ({
	TVOverlayPlugin: class {
		attach = overlayAttach;
		detach = vi.fn();
	},
}));

describe('videoPlayer unmount during import', () => {
	afterEach(() => vi.restoreAllMocks());

	it('does not create a ghost player, sync bridge, or overlay', async () => {
		const initError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const VideoPlayer = (await import('./VideoPlayer.vue')).default;
		const wrapper = mount(VideoPlayer, { props: { type: 'movie', id: '1' } });
		await importStarted;
		wrapper.unmount();

		finishImport();
		await import('@nomercy-entertainment/nomercy-video-player');
		await flushPromises();

		expect(setup).not.toHaveBeenCalled();
		expect(videoSyncBridge.current()).toBeNull();
		expect(overlayAttach).not.toHaveBeenCalled();
		expect(initError).not.toHaveBeenCalled();
	});
});
