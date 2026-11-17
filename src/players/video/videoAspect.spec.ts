import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The TV UI plugin does not ship the desktop UI's video rule, so the receiver
// must size the video itself; without it a 4:3 film overflows a 16:9 screen.
const style = readFileSync('src/players/video/VideoPlayer.vue', 'utf8').split('<style')[1] ?? '';

function videoRule(): string {
	const match = /\.video-player-root\s+:deep\(video\)\s*\{([^}]*)\}/.exec(style);

	return match?.[1] ?? '';
}

describe('video aspect on the TV', () => {
	it('fills the player box and letterboxes the picture', () => {
		const rule = videoRule();

		expect(rule).toMatch(/width:\s*100%/);
		expect(rule).toMatch(/height:\s*100%/);
		expect(rule).toMatch(/object-fit:\s*contain/);
	});
});
