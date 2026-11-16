import { describe, expect, it } from 'vitest';
import { decls } from '../cssDecl';

const P = 'views/profile/';

describe('about and server info match AboutScreen.kt / ServerInfoScreen.kt', () => {
	it('about.layout: gap 24 (AboutScreen.kt:73-82)', () => {
		expect(decls(`${P}AboutScreen.vue`, '.about-card').gap).toBe('24px');
	});

	it('about.product-card: description .85, copyright 12 at .7 (AboutScreen.kt:107-148)', () => {
		expect(decls(`${P}AboutScreen.vue`, '.tagline').color).toBe('rgba(255, 255, 255, 0.85)');
		const c = decls(`${P}AboutScreen.vue`, '.copyright');

		expect(c['font-size']).toBe('12px');
		expect(c.color).toBe('rgba(255, 255, 255, 0.7)');
		expect(decls(`${P}AboutScreen.vue`, '.footer')['margin-top']).toBe('4px');
	});

	it('serverinfo.card: width .7, r14 (ServerInfoScreen.kt:68-72)', () => {
		const c = decls(`${P}ServerInfoScreen.vue`, '.card');

		expect(c['max-width']).toBe('70%');
		expect(c['border-radius']).toBe('14px');
	});

	it('serverinfo.row: v pad 2 + 2, label 14 (ServerInfoScreen.kt:143-155)', () => {
		const k = decls(`${P}ServerInfoScreen.vue`, '.kv');

		expect(k['row-gap']).toBe('4px');
		expect(k['grid-template-columns']).toBe('140px 1fr');
		expect(decls(`${P}ServerInfoScreen.vue`, '.kv dt')['font-size']).toBe('14px');
	});
});

describe('settings match AppSettingsScreen.kt', () => {
	it('settings.menu-header: avatar 56, gap 16, name 22, email 14 (:474-486)', () => {
		const f = `${P}ProfileScreen.vue`;

		expect(decls(f, '.header-card').gap).toBe('16px');
		const a = decls(f, '.avatar');

		expect([a.width, a.height]).toEqual(['56px', '56px']);
		expect(decls(f, '.name')['font-size']).toBe('22px');
		expect(decls(f, '.email')['font-size']).toBe('14px');
	});

	it('settings.toggle-row: switch 56x32, knob 24, pad 16/20 (:1591-1641)', () => {
		const f = `${P}AppSettingsScreen.vue`;
		const t = decls(f, '.toggle');

		expect([t.width, t.height]).toEqual(['56px', '32px']);
		const k = decls(f, '.thumb');

		expect([k.width, k.height]).toEqual(['24px', '24px']);
		expect(decls(f, '.toggle.on .thumb').transform).toBe('translateX(24px)');
		expect(decls('styles/components.css', '.nm-list-row').padding).toBe('16px 20px');
	});

	it('settings.action-row: subtext at .6 (:1704-1726)', () => {
		expect(decls(`${P}AppSettingsScreen.vue`, '.row-secondary').opacity).toBe('0.6');
	});
});
