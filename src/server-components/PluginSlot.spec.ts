import { VueQueryPlugin } from '@tanstack/vue-query';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetch = vi.fn();

vi.mock('@/lib/http/client', () => ({
	apiFetch: (options: { path: string }) => apiFetch(options),
}));

const { default: PluginSlot } = await import('./PluginSlot.vue');

function serve(entries: Record<string, unknown>[]): void {
	apiFetch.mockImplementation(({ path }: { path: string }) => {
		if (path.includes('/plugins/ui'))
			return Promise.resolve({ data: [{ id: 'radio', name: 'Internet Radio', access: 'owned', nav_entries: entries }] });

		return Promise.resolve({ data: { components: [{ id: 'row', component: 'NMCarousel', props: { id: 'row', items: [] } }] } });
	});
}

function paths(): string[] {
	return apiFetch.mock.calls.map(call => call[0].path as string);
}

async function draw(kind: string, slotName: string) {
	const wrapper = mount(PluginSlot, {
		props: { kind, slotName },
		global: { plugins: [VueQueryPlugin], stubs: { Resolver: { props: ['component'], template: '<div class="resolved">{{ component.component }}</div>' } } },
	});

	await vi.waitFor(() => expect(apiFetch).toHaveBeenCalled());
	await vi.waitFor(() => expect(wrapper.vm.$nextTick()).resolves.toBeUndefined());
	await new Promise(resolve => setTimeout(resolve, 0));
	await wrapper.vm.$nextTick();

	return wrapper;
}

describe('a plugin placement on the receiver', () => {
	beforeEach(() => {
		apiFetch.mockReset();
		vi.restoreAllMocks();
	});

	it('asks the server for the cast view of the placement it draws', async () => {
		serve([{ section: 'music', label: 'Stations', route: '/', slot: 'home-row', surfaces: ['cast'] }]);

		await draw('music', 'home-row');

		await vi.waitFor(() => expect(paths().some(path => path.includes('/view?'))).toBe(true));
		expect(paths().find(path => path.includes('/view?'))).toContain('surface=cast');
	});

	it('draws the server\'s own components through the one resolver', async () => {
		serve([{ section: 'music', label: 'Stations', route: '/', slot: 'home-row', surfaces: ['cast'] }]);

		const wrapper = await draw('music', 'home-row');

		await vi.waitFor(() => expect(wrapper.findAll('.resolved')).toHaveLength(1));
		expect(wrapper.get('.resolved').text()).toBe('NMCarousel');
	});

	it('fetches no view for a placement marked for another surface, and says why', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		serve([{ section: 'music', label: 'Stations', route: '/', slot: 'home-row', surfaces: ['web'] }]);

		const wrapper = await draw('music', 'home-row');

		expect(paths().some(path => path.includes('/view?'))).toBe(false);
		expect(wrapper.findAll('.resolved')).toHaveLength(0);
		expect(warn.mock.calls.flat().join(' ')).toContain('PLUGIN_CAST_SURFACE_UNSUPPORTED');
	});

	it('draws nothing for a plugin this account has no access to', async () => {
		apiFetch.mockImplementation(({ path }: { path: string }) => {
			if (path.includes('/plugins/ui')) {
				return Promise.resolve({
					data: [{
						id: 'radio',
						name: 'Internet Radio',
						access: 'none',
						nav_entries: [{ section: 'music', label: 'Stations', route: '/', slot: 'home-row', surfaces: ['cast'] }],
					}],
				});
			}
			return Promise.resolve({ data: { components: [] } });
		});

		const wrapper = await draw('music', 'home-row');

		expect(paths().some(path => path.includes('/view?'))).toBe(false);
		expect(wrapper.findAll('.resolved')).toHaveLength(0);
	});

	it('draws nothing in a slot a receiver has no place for', async () => {
		serve([{ section: 'settings', label: 'Stations', route: '/', slot: 'section', surfaces: ['cast'] }]);

		const wrapper = await draw('settings', 'section');

		expect(paths().some(path => path.includes('/view?'))).toBe(false);
		expect(wrapper.findAll('.resolved')).toHaveLength(0);
	});

	it('takes the area and the slot from the payload when the server placed it', async () => {
		serve([{ section: 'video', label: 'Channels', route: '/live', slot: 'home-row', surfaces: ['cast'] }]);

		const wrapper = mount(PluginSlot, {
			props: { data: { id: 'slot', kind: 'video', slot: 'home-row' } },
			global: { plugins: [VueQueryPlugin], stubs: { Resolver: { props: ['component'], template: '<div class="resolved" />' } } },
		});

		await vi.waitFor(() => expect(paths().some(path => path.includes('/view?'))).toBe(true));
		expect(paths().find(path => path.includes('/view?'))).toContain(encodeURIComponent('/live'));
		wrapper.unmount();
	});
});
