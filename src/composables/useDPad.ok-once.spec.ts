import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';

import { useDPad } from '@/composables/useDPad';
import { useFocusEntry } from '@/composables/useFocusEntry';
import { useFocusGroup } from '@/composables/useFocusGroup';
import AppSettingsScreen from '@/views/profile/AppSettingsScreen.vue';
import { settingsStore } from '@/stores/settingsStore';

vi.mock('@/lib/diagnostics/sender', async () => {
	const { ref: makeRef } = await import('vue');

	return {
		diagnosticsSender: {
			state: makeRef('idle'),
			pending: makeRef(null),
			previewText: makeRef(''),
			hasPending: makeRef(false),
			lastError: makeRef(null),
			lastReportId: makeRef(''),
			prepare: vi.fn(),
			discard: vi.fn(),
			confirmSend: vi.fn(),
		},
	};
});

const router = {
	back: vi.fn(),
	replace: vi.fn(),
	currentRoute: { value: { path: '/profile' } },
};

const Host = defineComponent({
	setup() {
		useDPad(router as never);

		return () => h('div');
	},
});

// A focus entry with an action and no click handler.
const ActionOnly = defineComponent({
	props: { onRun: { type: Function, required: true } },
	setup(props) {
		const el = ref<HTMLElement | null>(null);
		const group = useFocusGroup({ type: 'vertical' });

		useFocusEntry({
			key: 'only-action',
			group,
			el,
			onAction: () => props.onRun(),
		});

		return () => h('button', {
			ref: el,
			'data-focusable': '',
			tabindex: 0,
		}, 'action');
	},
});

// A focusable element with a click handler and no focus entry.
const ClickOnly = defineComponent({
	props: { onRun: { type: Function, required: true } },
	setup(props) {
		useFocusGroup({ type: 'vertical' });

		return () => h('button', {
			'data-focusable': '',
			tabindex: 0,
			onClick: () => props.onRun(),
		}, 'click');
	},
});

// Like a real remote, the key goes to the focused element and bubbles up to window.
function pressOk(): void {
	const target = document.activeElement ?? document.body;

	target.dispatchEvent(new KeyboardEvent('keydown', {
		key: 'Enter',
		bubbles: true,
		cancelable: true,
	}));
}

describe('oK runs the focused action once', () => {
	let host: VueWrapper;
	let screen: VueWrapper | undefined;

	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
		host = mount(Host);
	});

	afterEach(() => {
		screen?.unmount();
		screen = undefined;
		host.unmount();
		document.body.replaceChildren();
	});

	function openSettings(): VueWrapper {
		screen = mount(AppSettingsScreen, {
			attachTo: document.body,
			global: { stubs: { RouterLink: true, teleport: true } },
		});

		return screen;
	}

	function focusRow(wrapper: VueWrapper, text: string): void {
		const row = wrapper.findAll('button').find((b) => b.text().includes(text));

		expect(row).toBeDefined();
		(row!.element as HTMLElement).focus();
		expect(document.activeElement).toBe(row!.element);
	}

	it('turns crash reports on with one OK and off with the next', () => {
		settingsStore.crashReports.value = false;
		focusRow(openSettings(), 'Send crash reports');

		pressOk();
		expect(settingsStore.crashReports.value).toBe(true);
		pressOk();
		expect(settingsStore.crashReports.value).toBe(false);
	});

	it('turns subtitle hints on with one OK and off with the next', () => {
		settingsStore.subtitleHints.value = false;
		focusRow(openSettings(), 'Subtitle hints');

		pressOk();
		expect(settingsStore.subtitleHints.value).toBe(true);
		pressOk();
		expect(settingsStore.subtitleHints.value).toBe(false);
	});

	// AppSettingsScreen.kt:1552 needs repeatCount == 0; SearchKeyboard.kt types a held OK once.
	it('does not run the action again while OK is held', () => {
		const run = vi.fn();
		const wrapper = mount(ActionOnly, { attachTo: document.body, props: { onRun: run } });
		const button = wrapper.find('button').element;

		button.focus();

		for (const repeat of [false, true, true]) {
			button.dispatchEvent(new KeyboardEvent('keydown', {
				key: 'Enter',
				repeat,
				bubbles: true,
				cancelable: true,
			}));
		}

		expect(run).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('control: an element with only an action runs it once', () => {
		const run = vi.fn();
		const wrapper = mount(ActionOnly, { attachTo: document.body, props: { onRun: run } });

		wrapper.find('button').element.focus();

		pressOk();
		expect(run).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	it('control: an element with only a click handler runs it once', () => {
		const run = vi.fn();
		const wrapper = mount(ClickOnly, { attachTo: document.body, props: { onRun: run } });

		wrapper.find('button').element.focus();

		pressOk();
		expect(run).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});
});
