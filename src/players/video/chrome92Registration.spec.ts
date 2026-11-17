import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = Object.hasOwn;
const nativeReplaceChildren = Element.prototype.replaceChildren;
const IMPORT_LINE = /^import .+$/gm;

interface Registered {
	subtitleOverlay: boolean;
	octopus: boolean;
	tvUi: boolean;
	errors: string[];
}

type Listen = (event: string, handler: (data: { error: Error }) => void) => void;

function restoreHasOwn(): void {
	Object.defineProperty(Object, 'hasOwn', {
		value: native,
		configurable: true,
		writable: true,
	});

	Object.defineProperty(Element.prototype, 'replaceChildren', {
		value: nativeReplaceChildren,
		configurable: true,
		writable: true,
	});
}

// The three plugins the receiver player needs; each failed to register on the TV with
// "Object.hasOwn is not a function" (the player library calls it, Chrome 93+).
async function registered(withPolyfill: boolean, withoutDom = false): Promise<Registered> {
	const errors: string[] = [];
	const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
	const host = document.createElement('div');

	host.id = 'nm-registration-probe';
	document.body.append(host);

	// The modules load while Object.hasOwn exists; only the registration runs without it.
	const mod = await import('@nomercy-entertainment/nomercy-video-player');
	const overlay = await import('@nomercy-entertainment/nomercy-video-player/plugins/subtitle-overlay');
	const { TvUiPlugin } = await import('./plugins/tv-ui');
	const { installChrome92Polyfills } = await import('@/lib/chrome92Polyfills');
	const player = mod.default('nm-registration-probe');
	const listen: Listen = (event, handler) => (player.on as Listen)(event, handler);

	listen('plugin:failed', (data) => {
		errors.push(data.error.message);
	});

	// The test runner itself calls Object.hasOwn, so it is missing only while the plugins register.
	Reflect.deleteProperty(Object, 'hasOwn');

	if (withoutDom) {
		Reflect.deleteProperty(Element.prototype, 'replaceChildren');
	}

	if (withPolyfill) {
		installChrome92Polyfills();
	}

	player.addPlugin(overlay.SubtitleOverlayPlugin);

	player.addPlugin(mod.OctopusPlugin, {
		workerUrl: '/js/octopus/nomercy-libass-worker.js',
		fallbackFont: '/js/octopus/default.ttf',
	});

	player.addPlugin(TvUiPlugin, { onExit: () => {} });

	// Plugins queue until setup(); each one then ends in plugin:installed or plugin:failed.
	const settled = new Promise<void>((resolve) => {
		let count = 0;

		const done = (): void => {
			count++;

			if (count === 3) {
				resolve();
			}
		};

		listen('plugin:installed', done);
		listen('plugin:failed', done);
		setTimeout(resolve, 3000);
	});

	try {
		player.setup({ playlist: [], autoPlay: false } as never);
		await settled;
	} finally {
		restoreHasOwn();
	}

	const result = {
		subtitleOverlay: Boolean(player.getPlugin(overlay.SubtitleOverlayPlugin)),
		octopus: Boolean(player.getPlugin(mod.OctopusPlugin)),
		tvUi: Boolean(player.getPlugin(TvUiPlugin)),
		errors,
	};

	spy.mockRestore();
	void player.dispose();
	host.remove();

	return result;
}

describe('plugin registration on a browser without Object.hasOwn (Chrome 92)', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(restoreHasOwn);

	it('control: the bare player library fails to register every plugin without the polyfill', async () => {
		const result = await registered(false);

		expect(result.errors.join('\n')).toContain('Object.hasOwn is not a function');

		expect(result).toMatchObject({
			subtitleOverlay: false,
			octopus: false,
			tvUi: false,
		});
	});

	it('registers the subtitle overlay, the libass renderer and the tv-ui once the polyfill ran', async () => {
		const result = await registered(true);

		expect(result.errors).toEqual([]);

		expect(result).toMatchObject({
			subtitleOverlay: true,
			octopus: true,
			tvUi: true,
		});
	});

	it('main.ts runs the polyfill before any other import', () => {
		const imports = readFileSync('src/main.ts', 'utf8').match(IMPORT_LINE) ?? [];

		expect(imports[0]).toBe('import \'./lib/chrome92Polyfills\';');
	});

	it('registers TV controls when Chrome 80 also lacks DOM replaceChildren', async () => {
		const result = await registered(true, true);

		expect(result.errors).toEqual([]);
		expect(result.tvUi).toBe(true);
	});
});
