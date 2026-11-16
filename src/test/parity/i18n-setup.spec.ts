// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllGlobals();
});

// Port of app-web's src/i18n/i18next.test.ts: the words are bundled, so no translation file is requested over HTTP.
it('starts on English with no HTTP request and English as the fallback', async () => {
	const fetchSpy = vi.fn(() => Promise.reject(new Error('no request expected')));
	vi.stubGlobal('fetch', fetchSpy);

	const { default: i18n } = await import('@/i18n/i18next');
	await new Promise(resolve => setTimeout(resolve, 50));

	expect(i18n.language).toBe('en');
	expect(i18n.options.fallbackLng).toEqual(['en']);
	expect(i18n.options.load).toBe('currentOnly');
	expect(fetchSpy).not.toHaveBeenCalled();
});

// Until every string reads t(), a Dutch device would see half Dutch, half English. Pass 5 lifts this.
it('stays on English on a Dutch device while the move to i18n is partial', async () => {
	vi.resetModules();
	vi.stubGlobal('navigator', { ...navigator, language: 'nl-NL' });

	const { default: i18n } = await import('@/i18n/i18next');
	await new Promise(resolve => setTimeout(resolve, 50));

	expect(i18n.language).toBe('en');
});
