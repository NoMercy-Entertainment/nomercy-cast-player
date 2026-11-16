import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface MoooomIconData {
	viewBox: string;
	fill: string;
	body: string;
}

const USED_MODULE = 'virtual:moooom-icons';
const SOURCE_FILE = /\.(?:vue|ts|tsx)$/;
const NOT_SOURCE = /\.(?:test|spec)\.|\.d\.ts$/;
const STRING_LITERAL = /["'`]([A-Z]\w*)["'`]/gi;

// The symbol is the single source: what the sprite draws today is what ships.
export function parseSprite(sprite: string): Record<string, MoooomIconData> {
	const icons: Record<string, MoooomIconData> = {};
	for (const [, attributes, inner] of sprite.matchAll(/<symbol\s([^>]*)>([\s\S]*?)<\/symbol>/g)) {
		const attribute = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(attributes!)?.[1];
		const id = attribute('id');
		if (!id)
			continue;
		icons[id] = {
			viewBox: attribute('viewBox') ?? '0 0 24 24',
			fill: attribute('fill') ?? 'none',
			body: inner!.replace(/\s+/g, ' ').replace(/> </g, '><').trim(),
		};
	}
	return icons;
}

export function scanSourceDir(dir: string): string[] {
	const texts: string[] = [];
	for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
		if (entry.isFile() && SOURCE_FILE.test(entry.name) && !NOT_SOURCE.test(entry.name))
			texts.push(fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8'));
	}
	return texts;
}

// A name passed as a variable still appears as a string literal in the map or
// conditional that feeds it, so literals alone cover both forms.
export function collectIconNames(sources: string[], known: Set<string>): Set<string> {
	const names = new Set<string>();
	for (const source of sources) {
		for (const [, literal] of source.matchAll(STRING_LITERAL)) {
			if (known.has(literal!))
				names.add(literal!);
		}
	}
	return names;
}

export function usedIconModule(icons: Record<string, MoooomIconData>, used: Set<string>): string {
	const picked = Object.fromEntries([...used].sort().map(name => [name, icons[name]]));
	return `export const moooomIcons = ${JSON.stringify(picked)};\n`;
}

export function moooomIconsPlugin(options: { sprites?: string[]; srcDir?: string } = {}): Plugin {
	let spritePaths = options.sprites ?? [];
	let srcDir = options.srcDir ?? '';
	let icons: Record<string, MoooomIconData> | null = null;
	let used: Set<string> | null = null;

	const state = () => {
		const all: Record<string, MoooomIconData> = icons ?? Object.assign({}, ...spritePaths.map(file => parseSprite(fs.readFileSync(file, 'utf8'))));
		icons = all;
		used ??= collectIconNames(scanSourceDir(srcDir), new Set(Object.keys(all)));
		return { icons: all, used };
	};

	return {
		name: 'moooom-icons',
		configResolved(config) {
			if (!spritePaths.length)
				spritePaths = ['mooooom-icons.svg', 'player-icons.svg'].map(name => path.resolve(config.root, 'resources', name));
			srcDir ||= path.resolve(config.root, 'src');
		},
		buildStart() {
			icons = null;
			used = null;
			for (const file of spritePaths)
				this.addWatchFile(file);
		},
		resolveId(id) {
			return id === USED_MODULE ? `\0${id}` : null;
		},
		load(id) {
			if (id === `\0${USED_MODULE}`)
				return usedIconModule(state().icons, state().used);
			return null;
		},
		configureServer(server) {
			const refresh = (file: string) => {
				if (!SOURCE_FILE.test(file) || NOT_SOURCE.test(file) || !path.resolve(file).startsWith(path.resolve(srcDir)))
					return;
				const before = used?.size ?? 0;
				used = null;
				if (state().used.size === before)
					return;
				const module = server.moduleGraph.getModuleById(`\0${USED_MODULE}`);
				if (module)
					server.moduleGraph.invalidateModule(module);
				server.ws.send({ type: 'full-reload' });
			};
			server.watcher.on('change', refresh).on('add', refresh).on('unlink', refresh);
		},
	};
}
