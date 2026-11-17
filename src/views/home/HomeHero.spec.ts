import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decls } from '@/test/cssDecl';
import HomeHero from './HomeHero.vue';

const CSS = 'styles/components.css';

describe('the hero backdrop follows the native hero (NMLolomo.kt:169)', () => {
	it('draws no image for a card that has only a poster', () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'p',
			title: 'Poster only',
			poster: '/p.jpg',
		} } });

		expect(wrapper.find('.art img').exists()).toBe(false);
	});

	it('draws the backdrop of a card (positive control)', () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'b',
			title: 'Backdrop',
			backdrop: '/b.jpg',
		} } });

		expect(wrapper.find('.art img').attributes('src')).toContain('/b.jpg');
	});

	it('keeps the previous slide when the next card has no backdrop', async () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'b',
			title: 'Backdrop',
			backdrop: '/b.jpg',
		} } });

		await wrapper.setProps({ card: {
			id: 'p',
			title: 'Poster only',
			poster: '/p.jpg',
		} });

		expect(wrapper.find('.art img').attributes('src')).toContain('/b.jpg');
	});

	it('crops the backdrop from the center (BackdropImageWithOverlay.kt:236-246)', () => {
		const wrapper = mount(HomeHero, { props: { card: {
			id: 'b',
			title: 'Backdrop',
			backdrop: '/b.jpg',
		} } });

		expect(wrapper.find('.art img').classes()).toContain('nm-cover-center');
		expect(wrapper.find('.art img').classes()).not.toContain('nm-cover-top');
	});
});

// BackdropImageWithOverlay.kt:83-129: preload, then a wipe that always finishes, newest request only.
describe('the hero backdrop wipe (HeroSlideshow)', () => {
	const decodes: { src: string; resolve: () => void }[] = [];

	class FakeImage {
		src = '';
		decode(): Promise<void> {
			return new Promise((resolve) => {
				decodes.push({ src: this.src, resolve });
			});
		}
	}

	const card = (id: string, backdrop?: string) => ({
		id,
		title: id,
		backdrop,
	});
	const layers = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.art .hero-layer');
	const srcs = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.art img').map((i) => i.attributes('src'));

	async function settle(wrapper: ReturnType<typeof mount>, ms = 0) {
		await vi.advanceTimersByTimeAsync(ms);
		await flushPromises();
		await wrapper.vm.$nextTick();
	}

	async function decodeLast(wrapper: ReturnType<typeof mount>) {
		decodes.at(-1)?.resolve();
		await settle(wrapper, 40);
	}

	beforeEach(() => {
		decodes.length = 0;
		vi.useFakeTimers();
		vi.stubGlobal('Image', FakeImage);

		vi.stubGlobal('requestAnimationFrame', (cb: () => void) =>
			setTimeout(cb, 16));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('preload-before-swap: keeps the shown image until the next one is decoded, then wipes', async () => {
		const wrapper = mount(HomeHero, { props: { card: card('a', '/a.jpg') } });

		await wrapper.setProps({ card: card('b', '/b.jpg') });
		await settle(wrapper);

		expect(decodes.map((d) => d.src)).toEqual([expect.stringContaining('/b.jpg')]);
		expect(srcs(wrapper)).toEqual([expect.stringContaining('/a.jpg')]);

		await decodeLast(wrapper);

		expect(srcs(wrapper)).toEqual([expect.stringContaining('/a.jpg'), expect.stringContaining('/b.jpg')]);
		expect(layers(wrapper)[1]?.classes()).toContain('running');

		await settle(wrapper, 1500);

		expect(srcs(wrapper)).toEqual([expect.stringContaining('/b.jpg')]);
		expect(layers(wrapper)[0]?.classes()).not.toContain('running');
	});

	it('preload-before-swap: still wipes when the decode fails', async () => {
		const wrapper = mount(HomeHero, { props: { card: card('a', '/a.jpg') } });

		vi.stubGlobal('Image', class {
			src = '';
			decode() {
				return Promise.reject(new Error('decode'));
			}
		});

		await wrapper.setProps({ card: card('b', '/b.jpg') });
		await settle(wrapper, 40);

		expect(srcs(wrapper)).toHaveLength(2);
	});

	it('newest-wins-after-running-wipe: a change during a wipe waits, then goes to the newest card only', async () => {
		const wrapper = mount(HomeHero, { props: { card: card('a', '/a.jpg') } });

		await wrapper.setProps({ card: card('b', '/b.jpg') });
		await decodeLast(wrapper);
		await wrapper.setProps({ card: card('c', '/c.jpg') });
		await wrapper.setProps({ card: card('d', '/d.jpg') });
		await settle(wrapper, 600);

		expect(decodes.map((d) => d.src)).toEqual([expect.stringContaining('/b.jpg')]);
		expect(srcs(wrapper)).toEqual([expect.stringContaining('/a.jpg'), expect.stringContaining('/b.jpg')]);

		await settle(wrapper, 1000);

		expect(srcs(wrapper)).toEqual([expect.stringContaining('/b.jpg')]);
		expect(decodes.map((d) => d.src)).toEqual([expect.stringContaining('/b.jpg'), expect.stringContaining('/d.jpg')]);

		await decodeLast(wrapper);
		await settle(wrapper, 1500);

		expect(srcs(wrapper)).toEqual([expect.stringContaining('/d.jpg')]);
	});

	it('same-backdrop-no-wipe: a new card with the same backdrop does not restart a wipe', async () => {
		const wrapper = mount(HomeHero, { props: { card: card('a', '/a.jpg') } });

		await wrapper.setProps({ card: card('a2', '/a.jpg') });
		await settle(wrapper, 100);

		expect(decodes).toHaveLength(0);
		expect(layers(wrapper)).toHaveLength(1);
		expect(layers(wrapper)[0]?.classes()).not.toContain('running');
	});

	it('missing-backdrop-keeps-previous: a card without a backdrop starts no wipe', async () => {
		const wrapper = mount(HomeHero, { props: { card: card('a', '/a.jpg') } });

		await wrapper.setProps({ card: card('p') });
		await settle(wrapper, 100);

		expect(decodes).toHaveLength(0);
		expect(srcs(wrapper)).toEqual([expect.stringContaining('/a.jpg')]);
	});

	it('runs 1400 ms on FastOutSlowIn with transforms only (HeroSelectionTiming.kt:33)', () => {
		const css = readFileSync(resolve(__dirname, 'HomeHero.vue'), 'utf8');
		const keyframes = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?\n\t\})/g)].map((m) => m[1]).join('\n');

		expect(css).toContain('1400ms cubic-bezier(0.4, 0, 0.2, 1)');
		expect(keyframes).toContain('transform');
		expect(keyframes.replace(/transform:[^;]+;/g, '')).not.toMatch(/(clip-path|width|left|opacity)\s*:/);
		expect(css).not.toContain('clip-path');
	});
});

describe('the hero text and scrim scale with the screen', () => {
	it('lets the overview fill its 60 percent column (VideoMusicHeroSection.kt:82,107)', () => {
		expect(decls(CSS, '.nm-hero-overview')['max-width']).toBeUndefined();
	});

	it('sizes the scrim from the screen, not from one fixed size (BackdropImageWithOverlay.kt:263-285)', () => {
		const background = decls(CSS, '.nm-hero-scrim').background ?? '';

		expect(background).not.toContain('1987px');
		expect(background).not.toContain('1728px');
		expect(background).toContain('100vw');
	});
});
