import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import Resolver from './Resolver.vue';
import { diagnosticsRing } from '@/lib/diagnostics/sink';
import type { Component } from './types';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

function labels(): Array<string | undefined> {
	return diagnosticsRing.snapshot().map(entry => entry.label);
}

describe('a component type the receiver cannot draw', () => {
	it('records the type once it is asked to draw it', () => {
		const component = { id: 'x', component: 'NMFutureCard', props: {} } as unknown as Component;

		mount(Resolver, { props: { component } });

		expect(labels()).toContain('unknownComponent NMFutureCard');
	});

	it('records nothing for a type it draws (positive control)', async () => {
		const before = labels().length;
		const component = { id: 'y', component: 'NMText', props: { id: 'y', text: 'Hi' } } as unknown as Component;

		mount(Resolver, { props: { component } });

		expect(labels().slice(before).filter(label => label?.startsWith('unknownComponent'))).toEqual([]);
	});
});
