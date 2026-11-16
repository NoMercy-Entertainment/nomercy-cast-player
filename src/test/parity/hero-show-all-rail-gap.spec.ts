import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { showAllLabel } from '@/server-components/showAllLabel';
import { decls } from '../cssDecl';

describe('home hero and rail match the KMP TV app (Arc measure of 7118323)', () => {
	it('show-all tile reads "Show All" over the title, ignoring more_link_text (TvHomeAdapter.kt:551)', () => {
		expect(showAllLabel('Latest in Movies')).toBe('Show All\nMovies');
		expect(showAllLabel('Shows')).toBe('Show All\nShows');
		expect(decls('server-components/NMCarousel.vue', '.show-all-text')['white-space']).toBe('pre-line');
	});

	it('hero overview is white and no layer dims the hero (VideoMusicHeroSection.kt:165-195)', () => {
		expect(decls('styles/components.css', '.nm-hero-overview').color).toBe('var(--nm-text-primary)');
		expect(decls('views/home/HomeHero.vue', '.hero').opacity).toBeUndefined();
		expect(decls('views/home/HomeHero.vue', '.content').opacity).toBeUndefined();
	});

	it('the hero crossfades in place, never out then in (VideoMusicHeroSection.kt:124-127)', () => {
		const t = readFileSync(resolve(__dirname, '../../views/home/HomeHero.vue'), 'utf8');
		expect(t).not.toContain('out-in');
	});

	it('the rail track keeps the ring room outside the card box, cards start at the KMP y (TvHomeAdapter.kt:525-534)', () => {
		const t = decls('components/rails/HorizontalRail.vue', '.rail-track');
		expect(t.padding).toBe('2px 40px');
		expect(t.margin).toBe('-2px 0');
		expect(decls('components/feedback/Skeleton.vue', '.skeleton-track').margin).toBe('-2px 0');
	});

	it('rows in the home container sit 8 apart (VideoContentList.kt:590-598)', () => {
		expect(decls('server-components/NMLolomo.vue', '.container-section').gap).toBe('8px');
	});
});
