import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';

import WatchScreen from './WatchScreen.vue';

// jsdom has no layout, so it has no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn();

const data = ref<{ playlist: unknown[]; item?: unknown } | undefined>(undefined);
const isLoading = ref(false);
const error = ref<Error | null>(null);
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }));

vi.mock('@/queries/usePlaylistQuery', () => ({
	usePlaylistQuery: () => ({
		data,
		isLoading,
		error,
		refetch: vi.fn(),
	}),
}));

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {}, query: routeQuery.value }),
}));

vi.mock('@tanstack/vue-query', () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/players/video/VideoPlayer.vue', () => ({
	default: {
		name: 'VideoPlayer',
		props: ['initialItem', 'resumeAt'],
		template: '<div />',
		emits: ['error'],
		mounted(this: { $emit: (event: string, message: string) => void }) {
			this.$emit('error', 'The video player could not start.');
		},
	},
}));

describe('the watch screen does not go black when there is nothing to play', () => {
	it('starts the requested episode before applying the resume position', () => {
		routeQuery.value = {
			season: '1',
			episode: '3',
			resume_at: '90',
		};

		data.value = { playlist: [{
			id: 1,
			season: 1,
			episode: 1,
		}, {
			id: 3,
			season: 1,
			episode: 3,
		}], item: {
			id: 1,
			season: 1,
			episode: 1,
		} };

		const wrapper = mount(WatchScreen, { props: { type: 'tv', id: '42' } });

		expect(wrapper.findComponent({ name: 'VideoPlayer' }).props()).toMatchObject({ initialItem: {
			id: 3,
			season: 1,
			episode: 3,
		}, resumeAt: 90 });

		routeQuery.value = {};
	});

	it('shows an error panel instead of a blank screen when the playlist has no item', () => {
		data.value = { playlist: [] };
		isLoading.value = false;
		error.value = null;

		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' } });

		expect(wrapper.text()).toContain('Nothing to play');
	});

	it('shows an error panel instead of a blank screen when the player fails to init', async () => {
		data.value = { playlist: [{ id: 1 }], item: { id: 1, title: 'Test' } };
		isLoading.value = false;
		error.value = null;

		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' } });

		await nextTick();

		expect(wrapper.text()).toContain('could not start');
	});
});

describe('the resume time is a finite number above zero', () => {
	afterEach(() => {
		routeQuery.value = {};
	});

	const cases: Array<[string, string, number | undefined]> = [
		['a plain number', '90', 90],
		['Infinity', 'Infinity', undefined],
		['an overflowing exponent', '1e999', undefined],
		['text', 'abc', undefined],
		['an empty value', '', undefined],
		['zero', '0', undefined],
		['a negative number', '-5', undefined],
	];

	it.each(cases)('passes the player %s (resume_at=%s) as %s', (_name, value, expected) => {
		routeQuery.value = { resume_at: value };
		data.value = { playlist: [{ id: 1 }], item: { id: 1 } };
		isLoading.value = false;
		error.value = null;
		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' } });

		expect(wrapper.findComponent({ name: 'VideoPlayer' }).props('resumeAt')).toBe(expected);
	});
});

describe('the position a phone sends in the watch route', () => {
	afterEach(() => {
		routeQuery.value = {};
	});

	const resumeOf = (query: Record<string, string>) => {
		routeQuery.value = query;
		data.value = { playlist: [{ id: 1 }], item: { id: 1 } };
		isLoading.value = false;
		error.value = null;
		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' } });

		return wrapper.findComponent({ name: 'VideoPlayer' }).props('resumeAt');
	};

	it('is milliseconds and becomes the resume time in seconds', () => {
		expect(resumeOf({ cast: 'true', position: '2576282' })).toBeCloseTo(2576.282);
	});

	it('yields to resume_at, and position 0 is no resume time', () => {
		expect(resumeOf({ resume_at: '90', position: '2576282' })).toBe(90);
		expect(resumeOf({ cast: 'true', position: '0' })).toBeUndefined();
	});
});

describe('every error panel on the watch screen is reachable with the D-pad', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = '';
	});

	const panels = [
		{
			name: 'load error',
			playlist: undefined,
			failure: new Error('made-up failure'),
		},
		{
			name: 'player error',
			playlist: { playlist: [{ id: 1 }], item: { id: 1, title: 'Test' } },
			failure: null,
		},
		{
			name: 'nothing to play',
			playlist: { playlist: [] },
			failure: null,
		},
	];

	it.each(panels)('focuses "Try again" on the $name panel without a focus warning', async ({ playlist, failure }) => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		data.value = playlist;
		error.value = failure;
		isLoading.value = false;

		const wrapper = mount(WatchScreen, { props: { type: 'movie', id: '1' }, attachTo: document.body });

		await nextTick();
		await nextTick();

		expect(warn.mock.calls.flat().join(' ')).not.toContain('used outside FocusGroup');
		expect(document.activeElement).toBe(wrapper.find('button').element);
		wrapper.unmount();
	});
});
