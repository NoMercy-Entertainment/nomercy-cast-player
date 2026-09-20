import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
	plugins: [vue(), tailwindcss()],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
	},
	test: {
		environment: 'node',
		globals: true,
		include: ['src/**/*.{test,spec}.ts'],
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
		allowedHosts: ['vscode.nomercy.tv', 'cast.nomercy.tv', 'cast-dev.nomercy.tv'],
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
		// Dev-only proxy so localhost:5501 can hit the user's server without
		// hitting CORS. CAST_DEV_SERVER_URL overrides the target when set.
		proxy: {
			'/api': {
				target: 'https://85-144-244-49.fcbb730a-a562-2ca5-d054-5d6acf2a1aaa.nomercy.tv:7626',
				changeOrigin: true,
				secure: false,
			},
			'/videoHub': {
				target: 'https://85-144-244-49.fcbb730a-a562-2ca5-d054-5d6acf2a1aaa.nomercy.tv:7626',
				changeOrigin: true,
				secure: false,
				ws: true,
			},
			'/musicHub': {
				target: 'https://85-144-244-49.fcbb730a-a562-2ca5-d054-5d6acf2a1aaa.nomercy.tv:7626',
				changeOrigin: true,
				secure: false,
				ws: true,
			},
		},
	},
});
