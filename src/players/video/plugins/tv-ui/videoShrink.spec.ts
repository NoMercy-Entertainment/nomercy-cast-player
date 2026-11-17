import { describe, expect, it } from 'vitest';
import { videoShrink } from './settingsModel';

// WatchScreen.kt:508-560: the picture shrinks to the right of the 320 sidebar with 24 and 48 margins.
describe('video shrink beside the settings sidebar', () => {
	it('scales to the room right of the sidebar and shifts its center there', () => {
		const shrink = videoShrink(960);

		expect(shrink.scale).toBeCloseTo(568 / 960, 5);
		expect(shrink.translateX).toBeCloseTo(148, 5);
		expect(shrink.radius).toBe(16);
	});

	it('never shrinks below half the screen', () => {
		expect(videoShrink(600).scale).toBe(0.5);
	});
});

// WatchScreen.kt:550-551: the picture centers between the title bottom and the screen bottom.
describe('vertical center below the title', () => {
	it('shifts the picture half the title bottom down', () => {
		expect(videoShrink(960, 69).translateY).toBe(34.5);
	});

	it('does not shift before the title is measured', () => {
		expect(videoShrink(960).translateY).toBe(0);
	});
});
