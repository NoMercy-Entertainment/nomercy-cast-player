import { afterEach, describe, expect, it } from 'vitest';
import { mountPlaybackOSD } from '@/players/video/pluginPanels/PlaybackOSD';
import { decls } from '../cssDecl';

const T = 'styles/tv-safe.css';

function mount(): ReturnType<typeof mountPlaybackOSD> {
	return mountPlaybackOSD({
		parent: document.body,
		title: 'Example Show',
		subtitle: 'S1E2 - Second Example',
		getCurrentTime: () => 0,
		getDuration: () => 100,
	});
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('player top bar matches TVTopBar.kt', () => {
	it('player.osd.top-bar: top band pad 32/40/32/32, black .8 to transparent (TVTopBar.kt:67-73)', () => {
		const t = decls(T, '.playback-osd-top');
		expect([t.position, t.top, t.left, t.right]).toEqual(['absolute', '0', '0', '0']);
		expect(t.padding).toBe('32px 40px 32px 32px');
		expect(t.background).toBe('linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent)');
		expect(t.background).not.toContain('backdrop');
	});

	it('player.osd.top-bar: title 18 medium, episode 14 white .8 (TVTopBar.kt:168-180)', () => {
		const a = decls(T, '.osd-top-title');
		expect([a['font-size'], a['font-weight']]).toEqual(['18px', '500']);
		const b = decls(T, '.osd-top-subtitle');
		expect([b['font-size'], b.color]).toEqual(['14px', 'rgba(255, 255, 255, 0.8)']);
	});

	it('player.osd.top-bar: bottom band title drops from 28 to 18 (TVTopBar.kt:168)', () => {
		expect(decls(T, '.osd-title')['font-size']).toBe('18px');
	});

	it('player.osd.top-bar: renders the title over the episode line, a top band not a full-screen panel', () => {
		const handle = mount();
		const top = document.querySelector('.playback-osd-top');
		expect(top).not.toBeNull();
		expect(top!.classList.contains('panel')).toBe(false);
		expect(top!.querySelector('.osd-top-title')?.textContent).toBe('Example Show');
		expect(top!.querySelector('.osd-top-subtitle')?.textContent).toBe('S1E2 - Second Example');
		handle.dispose();
	});

	it('player.osd.top-bar: follows setTitle, hides an empty episode line, shows and hides with the OSD', () => {
		const handle = mount();
		const top = document.querySelector<HTMLElement>('.playback-osd-top')!;
		handle.setTitle({ title: 'Other Show', subtitle: null });
		expect(top.querySelector('.osd-top-title')?.textContent).toBe('Other Show');
		expect(top.querySelector<HTMLElement>('.osd-top-subtitle')!.style.display).toBe('none');
		handle.setVisible(false);
		expect(top.classList.contains('is-visible')).toBe(false);
		handle.setVisible(true);
		expect(top.classList.contains('is-visible')).toBe(true);
		handle.dispose();
		expect(document.querySelector('.playback-osd-top')).toBeNull();
	});
});

describe('player center message matches CenterMessage.kt', () => {
	it('player.osd.center-message: top 48, pad 8/16, 16 px, black .7, r8 (CenterMessage.kt:33-44)', () => {
		const m = decls(T, '.osd-center-message');
		expect(m.top).toBe('48px');
		expect(m.padding).toBe('8px 16px');
		expect(m['font-size']).toBe('16px');
		expect(m.background).toBe('rgba(0, 0, 0, 0.7)');
		expect(m['border-radius']).toBe('8px');
	});

	it('player.osd.center-message: shows a message and hides on an empty one (CenterMessage.kt:29-31)', () => {
		const handle = mount();
		const el = document.querySelector<HTMLElement>('.osd-center-message')!;
		expect(el.classList.contains('is-visible')).toBe(false);
		handle.setMessage('Subtitles on');
		expect(el.textContent).toBe('Subtitles on');
		expect(el.classList.contains('is-visible')).toBe(true);
		handle.setMessage('');
		expect(el.classList.contains('is-visible')).toBe(false);
		handle.dispose();
		expect(document.querySelector('.osd-center-message')).toBeNull();
	});
});
