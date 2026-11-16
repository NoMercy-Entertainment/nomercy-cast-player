import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { useDPad } from '@/composables/useDPad';
import SettingsPanes from '@/views/profile/SettingsPanes.vue';
import { decls } from '../cssDecl';

vi.mock('@/lib/diagnostics/sender', async () => {
	const { ref } = await import('vue');

	return {
		diagnosticsSender: {
			state: ref('idle'),
			pending: ref(null),
			lastError: ref(null),
			lastReportId: ref(''),
			prepare: vi.fn(),
			discard: vi.fn(),
			confirmSend: vi.fn(),
		},
	};
});

Element.prototype.scrollIntoView = vi.fn();

const P = 'views/profile/';
let wrapper: VueWrapper;

async function boot(): Promise<void> {
	const Host = defineComponent({
		setup() {
			useDPad({
				back: vi.fn(),
				replace: vi.fn(),
				currentRoute: { value: { path: '/profile/settings' } },
			} as never);

			return () => h(SettingsPanes);
		},
	});

	wrapper = mount(Host, { attachTo: document.body, global: { stubs: {
		RouterLink: true,
		teleport: true,
		SetupBackdrop: true,
	} } });

	await flushPromises();
}

function press(key: string): void {
	(document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', {
		key,
		bubbles: true,
		cancelable: true,
	}));
}

const cats = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.category-item'));

function row(text: string): HTMLElement | undefined {
	return Array.from(document.querySelectorAll<HTMLElement>('.settings-right button')).find((b) => b.textContent?.includes(text));
}

afterEach(() => {
	wrapper?.unmount();
	document.body.innerHTML = '';
});

describe('settings two-pane layout matches AppSettingsScreen.kt', () => {
	it('settings.layout: left pane 320 wide with 32 end pad, right pane takes the rest (:258-333)', () => {
		const l = decls(`${P}SettingsPanes.vue`, '.settings-left');

		expect([l.width, l['padding-right'], l['box-sizing']]).toEqual(['320px', '32px', 'content-box']);
		const p = decls(`${P}SettingsPanes.vue`, '.settings-panes');

		expect(p.display).toBe('flex');
		expect(decls(`${P}SettingsPanes.vue`, '.settings-right').flex).toBe('1');
	});

	it('settings.layout: category gap 8, right rows gap 16 (:289,330)', () => {
		expect(decls(`${P}SettingsCategories.vue`, '.category-list').gap).toBe('8px');
		expect(decls(`${P}AppSettingsScreen.vue`, '.settings-list').gap).toBe('16px');
	});

	it('settings.category: pad 14/20, r10, selected fill .25, focused .45, 3 px ring (:528-554)', () => {
		const f = `${P}SettingsCategories.vue`;
		const c = decls(f, '.category-item');

		expect([c.padding, c['border-radius']]).toEqual(['14px 20px', '10px']);
		expect(decls(f, '.category-item.selected::before').opacity).toBe('0.25');
		expect(decls(f, '.category-item.selected:focus-visible::before').opacity).toBe('0.45');
		expect(decls(f, '.category-item:focus-visible')['box-shadow']).toBe('inset 0 0 0 3px var(--cast-white)');
	});
});

describe('settings categories behave like the KMP TV menu', () => {
	it('lists display, playback and privacy, the first one open', async () => {
		await boot();
		expect(cats().map((c) => c.textContent?.trim())).toEqual(['Display', 'Playback', 'Privacy']);
		expect(cats().map((c) => c.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
	});

	it('shows only the open category rows', async () => {
		await boot();
		expect(row('Subtitle hints')?.style.display).not.toBe('none');
		expect(row('Auto-skip intros and credits')?.style.display).toBe('none');
		cats()[1]!.click();
		await flushPromises();
		expect(row('Auto-skip intros and credits')?.style.display).not.toBe('none');
		expect(row('Subtitle hints')?.style.display).toBe('none');
	});

	it('moves between categories with UP and DOWN, and focus alone does not open one (:258-260)', async () => {
		await boot();
		cats()[0]!.focus();
		press('ArrowDown');
		expect(document.activeElement).toBe(cats()[1]);
		expect(cats()[1]?.getAttribute('aria-selected')).toBe('false');
		press('ArrowDown');
		expect(document.activeElement).toBe(cats()[2]);
		press('ArrowDown');
		expect(document.activeElement).toBe(cats()[2]);
	});

	it('oK on a category opens it and keeps focus on it', async () => {
		await boot();
		cats()[1]!.focus();
		press('Enter');
		await flushPromises();
		expect(cats()[1]?.getAttribute('aria-selected')).toBe('true');
		expect(document.activeElement).toBe(cats()[1]);
	});

	it('right enters the open category rows, left returns to the open category', async () => {
		await boot();
		cats()[1]!.focus();
		press('Enter');
		await flushPromises();
		press('ArrowRight');
		expect(document.activeElement).toBe(row('Auto-skip intros and credits'));
		press('ArrowLeft');
		expect(document.activeElement).toBe(cats()[1]);
	});
});
