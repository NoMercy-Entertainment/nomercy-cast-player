import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The TV ships one variable Roboto-Regular.ttf; the receiver's Chrome fakes weight 500 from it
// (wider letters, same spaces). KMP draws real Roboto Medium, so the receiver bundles real weights.
describe('the receiver bundles real Roboto weights', () => {
	const main = readFileSync(resolve(__dirname, '../../main.ts'), 'utf8');

	it.each(['400', '500', '700'])('loads Roboto %s from the bundle', (weight) => {
		expect(main).toContain(`import '@fontsource/roboto/${weight}.css';`);
	});
});
