export interface DeviceFacts {
	appVersion: string;
	model: string;
	abi: string;
	platformVersion: string;
	/** Zero means the figure was unavailable, never a measured zero. */
	heapCeilingMb: number;
	heapUsedMb: number;
	threads: number;
}

export const UNKNOWN_FACT = 'unknown';

const PLATFORM_TOKEN = /\(([^)]*)\)/;
const CHROME_VERSION = /Chrome\/([\d.]+)/;
const CAST_BUILD = /CrKey\/([\w.-]+)/;
const LINUX_PREFIX = /^Linux\s+/;
const BYTES_PER_MB = 1024 * 1024;

interface CastDeviceCapabilities {
	model?: unknown;
	device_model?: unknown;
}

/**
 * The CAF receiver SDK has no documented model field, so read it where a build
 * happens to expose one and say `unknown` rather than inventing a name.
 */
function readCastModel(): string {
	const framework = (globalThis as { cast?: { framework?: unknown } }).cast?.framework as
		| { CastReceiverContext?: { getInstance: () => { getDeviceCapabilities?: () => unknown } } }
		| undefined;

	try {
		const capabilities = framework?.CastReceiverContext
			?.getInstance()
			?.getDeviceCapabilities?.() as CastDeviceCapabilities | undefined;
		const model = capabilities?.model ?? capabilities?.device_model;
		if (typeof model === 'string' && model.length > 0)
			return model;
	}
	catch {
		// A partially loaded SDK must not cost us the rest of the report.
	}

	const build = CAST_BUILD.exec(userAgent());
	return build ? `CrKey ${build[1]}` : UNKNOWN_FACT;
}

function userAgent(): string {
	return globalThis.navigator?.userAgent ?? '';
}

function readAbi(): string {
	const platform = PLATFORM_TOKEN.exec(userAgent())?.[1] ?? '';
	const architecture = platform.split(';').at(-1)?.trim() ?? '';
	const withoutOs = architecture.replace(LINUX_PREFIX, '').trim();
	return withoutOs.length > 0 ? withoutOs : UNKNOWN_FACT;
}

function readPlatformVersion(): string {
	return CHROME_VERSION.exec(userAgent())?.[1] ?? UNKNOWN_FACT;
}

function toMb(bytes: number | undefined): number {
	if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0)
		return 0;
	return Math.round(bytes / BYTES_PER_MB);
}

export function collectDeviceFacts(): DeviceFacts {
	const memory = globalThis.performance?.memory;

	return {
		appVersion: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : UNKNOWN_FACT,
		model: readCastModel(),
		abi: readAbi(),
		platformVersion: readPlatformVersion(),
		heapCeilingMb: toMb(memory?.jsHeapSizeLimit),
		heapUsedMb: toMb(memory?.usedJSHeapSize),
		// A web receiver cannot count its own threads. Zero is the absence of a
		// figure, and the rendered report says so in words.
		threads: 0,
	};
}
