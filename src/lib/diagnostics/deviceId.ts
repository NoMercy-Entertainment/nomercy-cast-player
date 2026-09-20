const STORAGE_KEY = 'nm-cast-device-id-v1';

function randomId(): string {
	if (typeof globalThis.crypto?.randomUUID === 'function')
		return globalThis.crypto.randomUUID();
	return `cast-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Stable per-Cast-device identifier. The receiver has no identity of its own,
 * and a report that cannot be tied to a box is a report we cannot act on.
 */
export function castDeviceId(): string {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored)
			return stored;
		const fresh = randomId();
		localStorage.setItem(STORAGE_KEY, fresh);
		return fresh;
	}
	catch {
		return randomId();
	}
}
