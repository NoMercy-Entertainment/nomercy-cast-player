import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import NMCard from '@/server-components/NMCard.vue';
import { decls } from '../cssDecl';

vi.mock('vue-router', () => ({
	useRoute: () => ({ params: {} }),
	useRouter: () => ({ push: vi.fn() }),
}));

Element.prototype.scrollIntoView = vi.fn();

const FILE = 'server-components/NMCard.vue';

function draw(data: Record<string, unknown>): ReturnType<typeof mount> {
	return mount(NMCard, { props: { id: 'card-1', data: { id: 'card-1', ...data } as never } });
}

describe('card.caption matches item_card_poster.xml:45-78 / TvCardViewHolder.kt:213-239', () => {
	it('a subtitle card shows a one-line title and the subtitle inside the poster', () => {
		const w = draw({ title: 'Jordan Example', subtitle: 'Director (voice)' });
		const cap = w.find('.poster .caption');

		expect(cap.exists()).toBe(true);
		expect(cap.find('.caption-title').text()).toBe('Jordan Example');
		expect(cap.find('.caption-subtitle').text()).toBe('Director');
	});

	it('an episode card shows a two-line title and no subtitle', () => {
		const w = draw({ title: 'S1 E2 Example Episode', type: 'episode' });
		const cap = w.find('.poster .caption');

		expect(cap.exists()).toBe(true);
		expect(cap.find('.caption-title').classes()).toContain('caption-title-2');
		expect(cap.find('.caption-subtitle').exists()).toBe(false);
	});

	it('any other card keeps the image-only look', () => {
		expect(draw({ title: 'Plain Movie', type: 'movie' }).find('.caption').exists()).toBe(false);
	});

	it('caption strip: bottom, pad 4/8, #BF1A1A1A, white 11 and 10 Medium', () => {
		const c = decls(FILE, '.caption');

		expect(c.position).toBe('absolute');
		expect(c.inset).toBe('auto 0 0 0');
		expect(c.padding).toBe('4px 8px');
		expect(c.background).toBe('rgba(26, 26, 26, 0.749)');
		expect(decls(FILE, '.caption-title')['font-size']).toBe('11px');
		expect(decls(FILE, '.caption-title')['font-weight']).toBe('500');
		expect(decls(FILE, '.caption-title')['-webkit-line-clamp']).toBe('1');
		expect(decls(FILE, '.caption-title-2')['-webkit-line-clamp']).toBe('2');
		expect(decls(FILE, '.caption-subtitle')['font-size']).toBe('10px');
		expect(decls(FILE, '.caption-subtitle')['font-weight']).toBe('500');
	});
});
