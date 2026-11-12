import type { NMVideoPlayer } from '@nomercy-entertainment/nomercy-video-player';
import { mountPreScreen } from './pluginPanels/PreScreen';
import { mountEpisodeScreen } from './pluginPanels/EpisodeScreen';
import type { EpisodeItem } from './pluginPanels/EpisodeScreen';
import { mountLanguageScreen } from './pluginPanels/LanguageScreen';
import type { TrackItem } from './pluginPanels/LanguageScreen';
import { mountSeekContainer } from './pluginPanels/SeekContainer';
import { mountPlaybackOSD } from './pluginPanels/PlaybackOSD';
import type { PlaybackOSDHandle } from './pluginPanels/PlaybackOSD';
import { mountSkipChapterPrompt } from './pluginPanels/SkipChapterPrompt';
import type { SkipChapterPromptHandle } from './pluginPanels/SkipChapterPrompt';
import { mountOverlayHost } from './overlayHost';
import { settingsStore } from '@/stores/settingsStore';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';
import { decideSkipAction, segmentsForItem } from './skipSegments';

/**
 * TV overlay orchestrator per spec §12.3. Owns the pre-screen / episode
 * / language / seek panel lifecycle and routes player events to the
 * right panel. Ports the responsibility surface of
 * clients/nomercy-cast-player/.archive-v0/lib/VideoPlayer/plugins/UIPlugin/
 * tvUIPlugin.ts into a Vue-free, DOM-driven module.
 *
 * It does not extend the package's Plugin base class. It attaches through
 * the player's public on/off surface and mounts its panels in a host
 * element of its own inside the player container.
 */

type OverlayItem = EpisodeItem & {
	subtitle?: string;
	overview?: string;
	backdrop?: string | null;
	resumeFromMs?: number;
	skip_segments?: unknown;
	segments?: unknown;
};

// The overlay and the chapter plugin exchange events the player's typed map does not list.
interface LooseBus {
	on: (event: string, handler: (data?: unknown) => void) => void;
	off: (event: string, handler?: (data?: unknown) => void) => void;
};

export interface TVOverlayPluginOptions {
	skipPreScreen?: boolean;
	// Owns leaving the watch screen (e.g. router.back()). Pre-screen exit
	// must not go through the player's own 'back' event: that event is
	// what drives handleBack() in the first place, so re-emitting it here
	// would re-enter handleBack() for the same 'pre' state and recurse.
	onExit?: () => void;
}

export class TVOverlayPlugin {
	private currentPanel: 'pre' | 'episode' | 'language' | 'seek' | null = null;
	private unmount: (() => void) | null = null;
	private osd: PlaybackOSDHandle | null = null;
	private skipPrompt: SkipChapterPromptHandle | null = null;
	private nextPrompt: SkipChapterPromptHandle | null = null;
	private advancedItem: number | string | null = null;
	private host: HTMLElement | null = null;
	private boundHandlers: Array<{ event: string; handler: (data?: unknown) => void }> = [];

	constructor(
		private readonly player: NMVideoPlayer,
		private readonly opts: TVOverlayPluginOptions = {},
	) {}

	attach(): void {
		this.host = mountOverlayHost(this.player.container);
		if (!this.opts.skipPreScreen)
			this.showPreScreen();

		this.bind('back', () => this.handleBack());
		this.bind('show-language-screen', () => this.showLanguageScreen());
		this.bind('show-episode-screen', () => this.showEpisodeScreen());
		this.bind('pause', () => this.maybeShowPreScreen());
		this.bind('play', () => {
			this.closeAllPanels();
			this.ensureOSD();
		});
		this.bind('item', () => this.refreshOSD());
		this.bind('active', showing => this.osd?.setVisible(Boolean(showing)));
		this.bind('chapter-skip-available', (chapter) => {
			this.showSkipPrompt(chapter as { type?: string; endTime?: number; startTime?: number } | null);
		});
		this.bind('chapter-skip-clear', () => this.clearSkipPrompt());
		this.bind('time', () => this.updateNextEpisode());
		this.bind('item', () => {
			this.advancedItem = null;
			this.clearNextPrompt();
		});

		// CAF receiver remote shortcut keys — APK TvUiPlugin maps Channel
		// Up / Down to language and episode pickers; we mirror that, plus
		// listen for explicit 'audio' / 'episodes' key codes.
		document.addEventListener('keydown', this.onShortcut, true);
	}

	private onShortcut = (e: KeyboardEvent): void => {
		if (this.currentPanel !== null)
			return;
		switch (e.key) {
			case 'ArrowLeft':
			case 'ArrowRight':
				e.preventDefault();
				this.showSeekContainer();
				break;
			case 'ChannelUp':
			case 'MediaTrackNext':
			case 'l':
			case 'L':
				e.preventDefault();
				this.showLanguageScreen();
				break;
			case 'ChannelDown':
			case 'MediaTrackPrevious':
			case 'e':
			case 'E':
				e.preventDefault();
				this.showEpisodeScreen();
				break;
			default:
				break;
		}
	};

	detach(): void {
		this.closeAllPanels();
		this.osd?.dispose();
		this.osd = null;
		this.skipPrompt?.dispose();
		this.skipPrompt = null;
		this.clearNextPrompt();
		document.removeEventListener('keydown', this.onShortcut, true);
		for (const { event, handler } of this.boundHandlers) {
			(this.player as unknown as LooseBus).off(event, handler);
		}
		this.boundHandlers = [];
		this.host?.remove();
		this.host = null;
	}

	private showSkipPrompt(chapter: { type?: string; endTime?: number; startTime?: number } | null): void {
		const host = this.overlayHost();
		if (!host || !chapter)
			return;
		this.clearSkipPrompt();
		const label = chapter.type === 'credits' ? 'Skip credits' : 'Skip intro';
		this.skipPrompt = mountSkipChapterPrompt({
			parent: host,
			label,
			onSkip: () => {
				this.clearSkipPrompt();
				if (typeof chapter.endTime === 'number')
					void this.player.time(chapter.endTime);
			},
		});
	}

	private clearSkipPrompt(): void {
		this.skipPrompt?.dispose();
		this.skipPrompt = null;
	}

	private currentItem(): OverlayItem | undefined {
		return this.player.item?.() as OverlayItem | undefined;
	}

	private queueItems(): OverlayItem[] {
		return (this.player.queue?.() ?? []) as OverlayItem[];
	}

	private updateNextEpisode(): void {
		const item = this.currentItem();
		const items = this.queueItems();
		const index = this.player.index?.() ?? items.findIndex(entry => entry.id === item?.id);
		const hasNext = Boolean(item && index >= 0 && index < items.length - 1 && this.player.next);
		const action = decideSkipAction(this.playerCurrentTime(), segmentsForItem(item), hasNext);
		if (action === 'advance') {
			this.clearNextPrompt();
			if (item && this.advancedItem !== item.id) {
				this.advancedItem = item.id;
				void this.player.next?.();
			}
			return;
		}
		if (action !== 'next-button') {
			this.clearNextPrompt();
			return;
		}
		if (!this.nextPrompt && this.overlayHost()) {
			this.nextPrompt = mountSkipChapterPrompt({
				parent: this.overlayHost()!,
				label: 'Next episode',
				onSkip: () => {
					this.clearNextPrompt();
					void this.player.next?.();
				},
			});
		}
	}

	private clearNextPrompt(): void {
		this.nextPrompt?.dispose();
		this.nextPrompt = null;
	}

	private playerCurrentTime(): number {
		return this.player.time?.() ?? 0;
	}

	private playerDuration(): number {
		return this.player.duration?.() ?? 0;
	}

	private playerChapters(): Array<{ start: number; end?: number }> {
		return this.player.chapters?.() ?? [];
	}

	// 2.x track ids are strings and the setters take a list position, so the panel gets the position as id.
	private playerAudioTracks(): TrackItem[] {
		return (this.player.audioTracks?.() ?? []).map((track, index) => ({ id: index, label: track.label }));
	}

	private playerSubtitleTracks(): TrackItem[] {
		return (this.player.subtitles?.() ?? []).map((track, index) => ({ id: index, label: track.label }));
	}

	private playerQualityLevels(): TrackItem[] {
		return (this.player.qualityLevels?.() ?? []).map(level => ({ id: level.index, label: level.label }));
	}

	private playerCurrentAudioId(): string | number | null {
		return this.player.audioTrack?.()?.index ?? null;
	}

	private playerCurrentSubtitleId(): string | number | null {
		return this.player.subtitle?.()?.index ?? 'off';
	}

	private playerCurrentQualityId(): string | number {
		const current = this.player.quality?.();
		return typeof current === 'object' && current !== null ? current.index : -1;
	}

	private playerSetAudioTrack(id: string | number): void {
		void this.player.audioTrack?.(Number(id));
	}

	private playerSetSubtitleTrack(id: string | number): void {
		void this.player.subtitle?.(id === 'off' ? null : Number(id));
	}

	private playerSetQuality(id: string | number): void {
		this.player.quality?.(Number(id) < 0 ? 'auto' : Number(id));
	}

	private ensureOSD(): void {
		const host = this.overlayHost();
		if (!host || this.osd)
			return;
		const item = this.currentItem();
		this.osd = mountPlaybackOSD({
			parent: host,
			title: item?.title ?? '',
			subtitle: item?.subtitle ?? null,
			getCurrentTime: () => this.playerCurrentTime(),
			getDuration: () => this.playerDuration(),
			chapters: this.playerChapters(),
		});
	}

	private refreshOSD(): void {
		if (!this.osd)
			return;
		const item = this.currentItem();
		this.osd.setTitle({
			title: item?.title ?? '',
			subtitle: item?.subtitle ?? null,
		});
		this.osd.setChapters(this.playerChapters());
	}

	private bind(event: string, handler: (data?: unknown) => void): void {
		(this.player as unknown as LooseBus).on(event, handler);
		this.boundHandlers.push({ event, handler });
	}

	private overlayHost(): HTMLElement | null {
		return this.host;
	}

	private showPreScreen(): void {
		const host = this.overlayHost();
		if (!host)
			return;
		this.closeAllPanels();
		const item = this.currentItem();
		this.currentPanel = 'pre';
		this.unmount = mountPreScreen({
			parent: host,
			title: item?.title ?? 'Now playing',
			subtitle: item?.subtitle,
			overview: item?.overview,
			backdropUrl: item?.backdrop ?? null,
			resumeFromMs: item?.resumeFromMs ?? 0,
			showEpisodes: this.queueItems().length > 1,
			showLanguages: this.playerAudioTracks().length > 0 || this.playerSubtitleTracks().length > 0,
			onPlay: () => {
				this.closeAllPanels();
				void this.player.play();
			},
			onRestart: () => {
				this.closeAllPanels();
				void this.player.restart();
				void this.player.play();
			},
			onShowEpisodes: () => this.showEpisodeScreen(),
			onShowLanguages: () => this.showLanguageScreen(),
			onExit: () => this.opts.onExit?.(),
		});
	}

	private showEpisodeScreen(): void {
		const host = this.overlayHost();
		if (!host)
			return;
		this.closeAllPanels();
		this.currentPanel = 'episode';
		const episodes = this.queueItems();
		const current = this.currentItem();
		const currentTimeSec = this.playerCurrentTime();
		this.unmount = mountEpisodeScreen({
			parent: host,
			episodes,
			currentId: current?.id,
			currentTimeMs: Math.round(currentTimeSec * 1000),
			onPick: (item) => {
				this.closeAllPanels();
				this.player.item(item.id);
			},
			onExit: () => this.showPreScreen(),
		});
	}

	private showLanguageScreen(): void {
		const host = this.overlayHost();
		if (!host)
			return;
		this.closeAllPanels();
		this.currentPanel = 'language';
		const canSetQuality = Boolean(this.player.quality);
		this.unmount = mountLanguageScreen({
			parent: host,
			audioTracks: this.playerAudioTracks(),
			subtitleTracks: this.playerSubtitleTracks(),
			qualityLevels: this.playerQualityLevels(),
			currentAudioId: this.playerCurrentAudioId(),
			currentSubtitleId: this.playerCurrentSubtitleId(),
			currentQualityId: this.playerCurrentQualityId(),
			autoQualityLabel: null,
			autoSkipChapters: settingsStore.autoSkipChapters.value,
			onPickAudio: id => this.playerSetAudioTrack(id),
			onPickSubtitle: id => this.playerSetSubtitleTrack(id),
			onPickQuality: canSetQuality ? id => this.playerSetQuality(id) : undefined,
			onToggleAutoSkip: (next) => {
				settingsStore.autoSkipChapters.value = next;
			},
			onExit: () => this.showPreScreen(),
		});
	}

	showSeekContainer(): void {
		const host = this.overlayHost();
		if (!host)
			return;
		if (this.currentPanel === 'seek')
			return;
		this.closeAllPanels();
		this.currentPanel = 'seek';
		this.unmount = mountSeekContainer({
			parent: host,
			getCurrentTime: () => this.playerCurrentTime(),
			getDuration: () => this.playerDuration(),
			onCommit: (seconds) => {
				void this.player.time(seconds);
				this.closeAllPanels();
			},
			onCancel: () => this.closeAllPanels(),
		});
	}

	private maybeShowPreScreen(): void {
		if (this.currentPanel === null)
			this.showPreScreen();
	}

	private handleBack(): void {
		if (this.currentPanel === 'episode' || this.currentPanel === 'language') {
			this.showPreScreen();
		}
		else if (this.currentPanel === 'seek') {
			this.closeAllPanels();
		}
		else if (this.currentPanel === 'pre') {
			this.opts.onExit?.();
		}
		else {
			void this.player.pause();
			this.showPreScreen();
		}
	}

	private closeAllPanels(): void {
		try {
			this.unmount?.();
		}
		catch (error) {
			// best-effort
			recordSwallowed('tvOverlayCloseAllPanels', error);
		}
		this.unmount = null;
		this.currentPanel = null;
	}
}
