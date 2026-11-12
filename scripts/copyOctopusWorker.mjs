import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// The receiver serves the libass worker from its own origin so a TV on the
// LAN renders styled subtitles without internet. Copied, never committed.
export const OCTOPUS_FILES = [
	'default.ttf',
	'nomercy-libass-worker.data',
	'nomercy-libass-worker.js',
	'nomercy-libass-worker.wasm',
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function copyOctopusWorker(destination = join(root, 'public', 'js', 'octopus'), nodeModules = join(root, 'node_modules')) {
	const source = join(nodeModules, '@nomercy-entertainment', 'nomercy-subtitle-octopus', 'dist');
	mkdirSync(destination, { recursive: true });
	for (const file of OCTOPUS_FILES) {
		if (!existsSync(join(source, file)))
			throw new Error(`octopus worker file missing from the package: ${join(source, file)}`);
		copyFileSync(join(source, file), join(destination, file));
	}
	return OCTOPUS_FILES.map(file => join(destination, file));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
	copyOctopusWorker();
