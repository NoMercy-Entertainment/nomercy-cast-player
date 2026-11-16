import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

const { overlayOptions } = vi.hoisted(() => ({
	overlayOptions: [] as Array<{ onExit: () => void }>,
}));

vi.mock('@nomercy-entertainment/nomercy-video-player', () => ({
	default: () => {
		const player: Record<string, unknown> = {
			addPlugin: () => player,
			setup: () => player,
			on: () => {},
			off: () => {},
			once: () => {},
			duration: () => 0,
			dispose: async () => {},
		};
		return player;
	},
	OctopusPlugin: class {},
}));
vi.mock('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay', () => ({
	SubtitleOverlayPlugin: class {},
}));
vi.mock('./TVOverlayPlugin', () => ({
	TVOverlayPlugin: class {
		constructor(_player: unknown, options: { onExit: () => void }) {
			overlayOptions.push(options);
		}

		attach = vi.fn();
		detach = vi.fn();
	},
}));

const page = { template: '<div />' };

async function leaveFrom(path: string[]) {
	overlayOptions.length = 0;
	const router = createRouter({
		history: createWebHistory(),
		routes: [
			{ path: '/', component: page },
			{ path: '/splash', component: page },
			{ path: '/title', component: page },
			{ path: '/movie/:id/watch', component: page },
		],
	});
	for (const step of path)
		await router.push(step);
	const VideoPlayer = (await import('./VideoPlayer.vue')).default;
	const wrapper = mount(VideoPlayer, {
		props: { type: 'movie', id: '1' },
		global: { plugins: [router] },
	});
	await flushPromises();
	overlayOptions[0]!.onExit();
	await new Promise(resolve => setTimeout(resolve, 100));
	const landed = router.currentRoute.value.path;
	wrapper.unmount();
	return landed;
}

describe('leaving the video player', () => {
	it('lands on Home when the cast opened the player straight from the splash', async () => {
		expect(await leaveFrom(['/splash', '/movie/1/watch'])).toBe('/');
	});

	it('lands on Home when the player is the first page in the receiver', async () => {
		expect(await leaveFrom(['/movie/1/watch'])).toBe('/');
	});

	it('goes back one page after browsing in the receiver (positive control)', async () => {
		expect(await leaveFrom(['/', '/title', '/movie/1/watch'])).toBe('/title');
	});
});
