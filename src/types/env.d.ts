/// <reference types="vite/client" />
/// <reference types="@types/chromecast-caf-receiver" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue';

	const component: DefineComponent<object, object, unknown>;
	export default component;
}

interface ImportMetaEnv {
	readonly VITE_DEFAULT_AUTH_BASE_URL: string;
	readonly VITE_DEFAULT_API_BASE_URL: string;
	readonly DEV: boolean;
	readonly PROD: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;

interface Performance {
	readonly memory?: {
		readonly jsHeapSizeLimit: number;
		readonly totalJSHeapSize: number;
		readonly usedJSHeapSize: number;
	};
}
