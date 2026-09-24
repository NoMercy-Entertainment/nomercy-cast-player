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
import { settingsStore } from '@/stores/settingsStore';
import { recordSwallowed } from '@/lib/diagnostics/swallowed';

/**
 * TV overlay orchestrator per spec §12.3. Owns the pre-screen / episode
 * / language / seek panel lifecycle and routes player events to the
 * right panel. Ports the responsibility surface of
 * clients/nomercy-cast-player/.archive-v0/lib/VideoPlayer/plugins/UIPlugin/
 * tvUIPlugin.ts into a Vue-free, DOM-driven module.
 *
 * The npm @nomercy-entertainment/nomercy-video-player package's Plugin
 * base class shape varies across versions; this file does not extend it
 * directly. Instead we attach via the player's public on/off + overlay
 * surface so the receiver isn't pinned to a specific plugin contract.
 */

interface PlayerLike {
	overlay?: HTMLElement;
	on: (event: string, handler: (data?: unknown) => void) => void;
	off: (event: string, handler?: (data?: unknown) => void) => void;
	emit?: (event: string, data?: unknown) => void;
	play: () => void;
	pause: () => void;
	seek: (seconds: number) => void;
	restart?: () => void;

	// 1.x unified getter/setter API
	currentTime?: () => number;
	duration?: () => number;
	audioTrackIndex?: () => number;
	subtitleIndex?: () => number;
	audioTracks?: () => TrackItem[];
	subtitles?: () => TrackItem[];
	qualityLevels?: () => TrackItem[];
	quality?: (index?: number) => number | void;
	audioTrack?: (index?: number) => unknown;
	subtitle?: (index?: number) => unknown;
	chapters?: () => Array<{ start: number; end?: number }>;
	chapter?: (currentTime: number) => { id: string; type?: string; startTime?: number; endTime?: number } | null | undefined;

	// 0.x deprecated shims still present in 1.x
	getCurrentTime?: () => number;
	getDuration?: () => number;
	getAudioTracks?: () => TrackItem[];
	getSubtitleTracks?: () => TrackItem[];
	getQualityLevels?: () => TrackItem[];
	getCurrentQuality?: () => string | number | null;
	getChapters?: () => Array<{ start: number; end?: number }>;

	playlist?: () => EpisodeItem[];
	playlistItem?: () => {
		id: number | string;
		title: string;
		subtitle?: string;
		overview?: string;
		backdrop?: string | null;
		resumeFromMs?: number;
	};
}

export interface TVOverlayPluginOptions {
	skipPreScreen?: boolean;
}

export class TVOverlayPlugin {
	private currentPanel: 'pre' | 'episode' | 'language' | 'seek' | null = null;
	private unmount: (() => void) | null = null;
	private osd: PlaybackOSDHandle | null = null;
	private skipPrompt: SkipChapterPromptHandle | null = null;
	private boundHandlers: Array<{ event: string; handler: (data?: unknown) => void }> = [];

	constructor(
		private readonly player: PlayerLike,
		private readonly opts: TVOverlayPluginOptions = {},
	) {}

	attach(): void {
		if (!this.opts.skipPreScreen)
			this.showPreScreen();

		// 1.x removed 'back-button'; wire keydown instead (already done below
		// via onShortcut). Also listen to the CAF receiver's own back event.
		this.bind('back', () => this.handleBack());
		this.bind('show-language-screen', () => this.showLanguageScreen());
		this.bind('show-episode-screen', () => this.showEpisodeScreen());
		this.bind('pause', () => this.maybeShowPreScreen());
		this.bind('play', () => {
			this.closeAllPanels();
			this.ensureOSD();
		});
		this.bind('item', () => this.refreshOSD());
		// 1.x: 'active' replaces showControls/hideControls (deprecated forwarders
		// still re-emit showControls/hideControls, but bind to active directly).
		this.bind('active', showing => this.osd?.setVisible(Boolean(showing)));
		this.bind('showControls', () => this.osd?.setVisible(true));
		this.bind('hideControls', () => this.osd?.setVisible(false));
		this.bind('chapter-skip-available', (chapter) => {
			this.showSkipPrompt(chapter as { type?: string; endTime?: number; startTime?: number } | null);
		});
		this.bind('chapter-skip-clear', () => this.clearSkipPrompt());

		// CAF receiver remote shortcut keys — APK TvUiPlugin maps Channel
		// Up / Down to language and episode pickers; we mirror that, plus
		// listen for explicit 'audio' / 'episodes' key codes.
		document.addEventListener('keydown', this.onShortcut, true);
	}

	private onShortcut = (e: KeyboardEvent): void => {
		if (this.currentPanel !== null)
			return;
		switch (e.key) {
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
		document.removeEventListener('keydown', this.onShortcut, true);
		for (const { event, handler } of this.boundHandlers) {
			this.player.off(event, handler);
		}
		this.boundHandlers = [];
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
					this.player.seek(chapter.endTime);
			},
		});
	}

	private clearSkipPrompt(): void {
		this.skipPrompt?.dispose();
		this.skipPrompt = null;
	}

	private playerCurrentTime(): number {
		return this.player.currentTime?.() ?? this.player.getCurrentTime?.() ?? 0;
	}

	private playerDuration(): number {
		return this.player.duration?.() ?? this.player.getDuration?.() ?? 0;
	}

	private playerChapters(): Array<{ start: number; end?: number }> {
		return this.player.chapters?.() ?? this.player.getChapters?.() ?? [];
	}

	private playerAudioTracks(): TrackItem[] {
		return this.player.audioTracks?.() ?? this.player.getAudioTracks?.() ?? [];
	}

	private playerSubtitleTracks(): TrackItem[] {
		return this.player.subtitles?.() ?? this.player.getSubtitleTracks?.() ?? [];
	}

	private playerQualityLevels(): TrackItem[] {
		return this.player.qualityLevels?.() ?? this.player.getQualityLevels?.() ?? [];
	}

	private playerCurrentAudioId(): string | number | null {
		return this.player.audioTrackIndex?.() ?? null;
	}

	private playerCurrentSubtitleId(): string | number | null {
		return this.player.subtitleIndex?.() ?? null;
	}

	private playerCurrentQualityId(): string | number {
		if (this.player.quality) {
			const q = this.player.quality();
			return typeof q === 'number' ? q : -1;
		}
		return this.player.getCurrentQuality?.() ?? -1;
	}

	private playerSetAudioTrack(id: string | number): void {
		if (this.player.audioTrack)
			this.player.audioTrack(Number(id));
	}

	private playerSetSubtitleTrack(id: string | number): void {
		if (this.player.subtitle)
			this.player.subtitle(id === 'off' ? -1 : Number(id));
	}

	private playerSetQuality(id: string | number): void {
		if (this.player.quality)
			this.player.quality(Number(id));
	}

	private ensureOSD(): void {
		const host = this.overlayHost();
		if (!host || this.osd)
			return;
		const item = this.player.playlistItem?.();
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
		const item = this.player.playlistItem?.();
		this.osd.setTitle({
			title: item?.title ?? '',
			subtitle: item?.subtitle ?? null,
		});
		this.osd.setChapters(this.playerChapters());
	}

	private bind(event: string, handler: (data?: unknown) => void): void {
		this.player.on(event, handler);
		this.boundHandlers.push({ event, handler });
	}

	private overlayHost(): HTMLElement | null {
		return this.player.overlay ?? null;
	}

	private showPreScreen(): void {
		const host = this.overlayHost();
		if (!host)
			return;
		this.closeAllPanels();
		const item = this.player.playlistItem?.();
		this.currentPanel = 'pre';
		this.unmount = mountPreScreen({
			parent: host,
			title: item?.title ?? 'Now playing',
			subtitle: item?.subtitle,
			overview: item?.overview,
			backdropUrl: item?.backdrop ?? null,
			resumeFromMs: item?.resumeFromMs ?? 0,
			showEpisodes: (this.player.playlist?.()?.length ?? 0) > 1,
			showLanguages: this.playerAudioTracks().length > 0 || this.playerSubtitleTracks().length > 0,
			onPlay: () => {
				this.closeAllPanels();
				this.player.play();
			},
			onRestart: () => {
				this.closeAllPanels();
				if (this.player.restart)
					this.player.restart();
				else this.player.seek(0);
				this.player.play();
			},
			onShowEpisodes: () => this.showEpisodeScreen(),
			onShowLanguages: () => this.showLanguageScreen(),
			onExit: () => this.player.emit?.('back'),
		});
	}

	private showEpisodeScreen(): void {
		const host = this.overlayHost();
		if (!host)
			return;
		this.closeAllPanels();
		this.currentPanel = 'episode';
		const episodes = this.player.playlist?.() ?? [];
		const current = this.player.playlistItem?.();
		const currentTimeSec = this.playerCurrentTime();
		this.unmount = mountEpisodeScreen({
			parent: host,
			episodes,
			currentId: current?.id,
			currentTimeMs: Math.round(currentTimeSec * 1000),
			onPick: (item) => {
				this.closeAllPanels();
				this.player.emit?.('load-item', item);
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
				this.player.seek(seconds);
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
			this.player.emit?.('back');
		}
		else {
			this.player.pause();
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
