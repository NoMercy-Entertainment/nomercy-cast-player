import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import type { ProxyOptions } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json' with { type: 'json' };

// Dev-only proxy so localhost:5501 can hit the user's server without hitting
// CORS. The target comes from CAST_DEV_SERVER_URL (.env or the shell): this
// repo is public, so no server address may live in the file.
function devProxy(command: 'build' | 'serve', mode: string, target: string | undefined): Record<string, ProxyOptions> | undefined {
	if (command !== 'serve')
		return undefined;
	if (!target) {
		if (mode !== 'test') {
			console.warn(
				'[cast] CAST_DEV_SERVER_URL is not set: /api, /videoHub and /musicHub are not proxied.\n'
				+ '[cast] Copy .env.example to .env and set it to your NoMercy server URL to talk to a server from the dev server.',
			);
		}
		return undefined;
	}
	return {
		'/api': { target, changeOrigin: true },
		'/videoHub': { target, changeOrigin: true, ws: true },
		'/musicHub': { target, changeOrigin: true, ws: true },
	};
}

function devAllowedHosts(list: string | undefined, target: string | undefined): string[] {
	const hosts = (list ?? '').split(',').map(h => h.trim()).filter(Boolean);
	if (target)
		hosts.push(new URL(target).hostname);
	return hosts;
}

export default defineConfig(({ command, mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const target = env.CAST_DEV_SERVER_URL || undefined;

	return {
		plugins: [vue(), tailwindcss()],
		define: {
			__APP_VERSION__: JSON.stringify(pkg.version),
		},
		test: {
			// jsdom rather than node: a template condition is only wrong once it
			// renders, and nothing below rendering can see it.
			environment: 'jsdom',
			globals: true,
			include: ['src/**/*.{test,spec}.{ts,vue}'],
			exclude: ['**/node_modules/**', '**/docs/**'],
		},
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
		build: {
			outDir: 'docs',
			target: 'es2022',
			sourcemap: true,
			rollupOptions: {
				output: {
					// Vite 8 swapped rollup → rolldown; manualChunks is function-only now.
					manualChunks(id: string): string | undefined {
						if (id.includes('node_modules/@microsoft/signalr'))
							return 'cast-sdk';
						if (id.includes('node_modules/@nomercy-entertainment/nomercy-video-player')) {
							return 'video-player';
						}
						if (id.includes('node_modules/hls.js'))
							return 'hls';
						return undefined;
					},
				},
			},
		},
		server: {
			open: true,
			port: 5501,
			allowedHosts: devAllowedHosts(env.CAST_DEV_ALLOWED_HOSTS, target),
			fs: {
				// Explicit deny — anything that holds credentials or private keys
				// must never be reachable via /@fs/. Pinned here so a future config
				// change can't accidentally expose secrets.
				deny: [
					'.env',
					'.env.*',
					'**/.env',
					'**/.env.*',
					'*.{crt,pem,key,pfx,p12,cer}',
					'**/*.{crt,pem,key,pfx,p12,cer}',
					'**/secrets/**',
					'**/.git/**',
					'**/.aws/**',
					'**/.ssh/**',
					'**/id_rsa*',
					'**/id_ed25519*',
				],
			},
			proxy: devProxy(command, mode, target),
		},
	};
});
