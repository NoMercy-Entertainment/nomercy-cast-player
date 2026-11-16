import { Plugin } from '@nomercy-entertainment/nomercy-player-core';
import type { NMVideoPlayer } from '@nomercy-entertainment/nomercy-video-player';
import { settingsStore } from '@/stores/settingsStore';
import { el, moveFocus, t } from './dom';
import type { Direction } from './dom';
import { mediaAbsentClaims } from './errors';
import { keyOf, routeRootKey, sharedKeyAction } from './keys';
import type { KeyName } from './keys';
import { bottomBar, episodeDialog, errorDialog, languageDialog, messageDialog, preScreen, seekStrip, settingsPanel, topBar, volumeIndicator } from './panels';
import type { BottomBarHandle, Choice, Panel, SeekStripHandle, UiItem } from './panels';
import { cancelSeek, canEnterSeekMode, chapterSeekTarget, commitSeek, frameTimesFor, seekStripKey, snapIndex } from './seek';
import { BACKGROUND_CHOICES, FONT_SIZE_CHOICES } from './settingsModel';
import { backAction, settingsStepBack } from './state';
import type { SettingsNav, StyleProp } from './state';
import './style.css';

export interface TvUiOptions {
	skipPreScreen?: boolean;
	// Owns leaving the watch screen (router back); the plugin never navigates itself.
	onExit?: () => void;
	// A live channel claims its keys first and answers whether it took the key.
	onLiveKey?: (key: string) => boolean;
}

export interface TvUiEvents {
	'pre-screen': { visible: boolean };
	'settings': { open: boolean };
	'exit': undefined;
}

interface Engine {
	play: () => unknown;
	pause: () => unknown;
	restart: () => unknown;
	next?: () => unknown;
	item: (id?: number | string) => UiItem | undefined;
	queue: () => UiItem[];
	index?: () => number;
	time: (seconds?: number) => number;
	duration: () => number;
	chapters?: () => Array<{ start: number; end?: number }>;
	audioTracks?: () => Array<{ label: string }>;
	audioTrack?: (index?: number) => { index: number } | undefined;
	subtitles?: () => Array<{ label: string }>;
	subtitle?: (index?: number | null) => { index: number } | null | undefined;
	qualityLevels?: () => Array<{ index: number; label: string }>;
	quality?: (value?: number | 'auto') => { index: number } | string | undefined;
	toggleMute?: () => void;
	isPlaying?: () => boolean;
	paused?: () => boolean;
	subtitleStyle?: (patch?: Record<string, unknown>) => Record<string, unknown> | undefined;
}

const AUTO_HIDE_MS = 5000;
const VOLUME_MS = 2000;
const ARROWS: Partial<Record<KeyName, Direction>> = { left: 'left', right: 'right', up: 'up', down: 'down' };

export class TvUiPlugin extends Plugin<NMVideoPlayer, TvUiOptions, TvUiEvents> {
	static override readonly id = 'tv-ui';
	static override readonly version = '1.0.0';
	static override readonly description = 'The TV overlay: pre-screen, transport bars, scrub strip, dialogs and settings, with the KMP TV key map';

	private root!: HTMLElement;
	private preScreenVisible = false;
	private episodeOpen = false;
	private languageOpen = false;
	private searchOpen = false;
	private settings: SettingsNav | null = null;
	private seekMode = false;
	private controlsVisible = false;
	private remote = false;
	private error: string | null = null;
	private absenceAnswered = false;
	private volumeShown: { volume: number; muted: boolean } | null = null;
	private frameTimes: number[] = [];
	private frameIndex = 0;
	private bar: BottomBarHandle | null = null;
	private strip: SeekStripHandle | null = null;
	private panel: Panel | null = null;
	private hideTimer = 0;
	private volumeTimer = 0;
	private enteredAt = 0;

	private get engine(): Engine {
		return this.player as unknown as Engine;
	}

	override use(): void {
		this.root = this.mount('tv-ui');
		this.root.classList.add('tvui-root');
		this.preScreenVisible = !this.opts?.skipPreScreen;
		this.listen(window, 'keydown', event => this.onKey(event), { capture: true });
		this.on('play', () => this.onPlayState(true));
		this.on('pause', () => this.onPlayState(false));
		this.on('time', () => this.updateBar());
		this.on('item', () => {
			this.seekMode = false;
			this.error = null;
			this.absenceAnswered = false;
			this.refresh();
		});
		this.on('error', (error) => {
			this.error = typeof error === 'string' ? error : (error as { message?: string } | undefined)?.message ?? 'error';
			this.absenceAnswered = false;
			this.refresh();
		});
		this.refresh();
	}

	showPreScreen(): void {
		this.preScreenVisible = true;
		this.emit('pre-screen', { visible: true });
		this.refresh();
	}

	hidePreScreen(): void {
		this.preScreenVisible = false;
		this.emit('pre-screen', { visible: false });
		this.refresh();
	}

	isPreScreenVisible(): boolean {
		return this.preScreenVisible;
	}

	// The one BACK path (TvUiPlugin.kt:298-346). Returns whether the overlay took the key.
	handleBack(): boolean {
		const action = backAction({
			search: this.searchOpen,
			settings: this.settings !== null,
			episodeOrLanguage: this.episodeOpen || this.languageOpen,
			seekMode: this.seekMode,
			controlsVisible: this.controlsVisible,
			preScreen: this.preScreenVisible,
			remote: this.remote,
		});
		switch (action) {
			case 'closeSearch': this.searchOpen = false; break;
			case 'settingsStepBack': this.stepBackSettings(); return true;
			case 'closeDialogToPreScreen': this.episodeOpen = false; this.languageOpen = false; this.preScreenVisible = true; break;
			case 'cancelSeek': cancelSeek(() => undefined, () => void this.engine.play()); this.seekMode = false; this.controlsVisible = false; break;
			case 'hideControls': this.controlsVisible = false; break;
			case 'pauseToPreScreen': void this.engine.pause(); this.preScreenVisible = true; break;
			case 'pauseAndExit': void this.engine.pause(); this.opts?.onExit?.(); this.emit('exit'); return false;
			case 'exit': this.opts?.onExit?.(); this.emit('exit'); return true;
		}
		this.refresh();
		return true;
	}

	private blockingUi(): boolean {
		return this.preScreenVisible || this.episodeOpen || this.languageOpen || this.searchOpen || this.settings !== null;
	}

	private onPlayState(playing: boolean): void {
		if (playing && this.preScreenVisible)
			this.preScreenVisible = false;
		if (this.blockingUi() || playing)
			this.controlsVisible = false;
		else
			this.controlsVisible = true;
		this.clearHide();
		this.refresh();
	}

	private scheduleHide(): void {
		this.clearHide();
		this.hideTimer = this.timeout(() => {
			if (!this.engine.paused?.()) {
				this.controlsVisible = false;
				this.refresh();
			}
		}, AUTO_HIDE_MS);
	}

	private clearHide(): void {
		window.clearTimeout(this.hideTimer);
	}

	private onKey(event: KeyboardEvent): void {
		if (this.opts?.onLiveKey?.(event.key)) {
			event.preventDefault();
			event.stopImmediatePropagation();
			return;
		}
		const key = keyOf(event);
		const consumed = this.route(key);
		if (consumed) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	}

	private route(key: KeyName): boolean {
		if (key === 'back')
			return this.handleBack() || this.remote === false;
		if (this.seekMode)
			return this.seekKey(key);
		const dialogOpen = this.episodeOpen || this.languageOpen || this.searchOpen || this.settings !== null;
		const route = routeRootKey({
			preScreen: this.preScreenVisible,
			dialogOpen,
			seekMode: false,
			controlsVisible: this.controlsVisible,
			topBarFocused: Boolean(document.activeElement?.closest('.tvui-top-bar')),
			duration: this.engine.duration(),
		}, key);
		switch (route.action) {
			case 'enterSeek': this.enterSeek(); return true;
			case 'showControls': this.controlsVisible = true; this.refresh(); return true;
			case 'rescheduleHide': this.scheduleHide(); break;
			case 'togglePlay': void (this.engine.paused?.() ? this.engine.play() : this.engine.pause()); return true;
			case 'volume': this.showVolume(); return false;
			case 'shared': return this.shared(key);
			case 'none': break;
		}
		if (this.blockingUi() || this.controlsVisible || this.panel)
			return this.focusKey(key);
		return false;
	}

	private focusKey(key: KeyName): boolean {
		const direction = ARROWS[key];
		if (direction) {
			moveFocus(this.root, direction);
			return true;
		}
		if (key === 'center') {
			(document.activeElement as HTMLElement | null)?.click();
			return true;
		}
		return false;
	}

	private shared(key: KeyName): boolean {
		const action = sharedKeyAction(key);
		const starts = (this.engine.chapters?.() ?? []).map(chapter => chapter.start);
		switch (action) {
			case 'toggleMute': this.engine.toggleMute?.(); return true;
			case 'seekBack': this.engine.time(chapterSeekTarget(starts, this.engine.time(), false, 10)); return true;
			case 'seekForward': this.engine.time(chapterSeekTarget(starts, this.engine.time(), true, 10)); return true;
			default: return false;
		}
	}

	private enterSeek(): void {
		if (!canEnterSeekMode(this.engine.duration()))
			return;
		this.controlsVisible = true;
		void this.engine.pause();
		this.seekMode = true;
		this.frameTimes = frameTimesFor(undefined, this.engine.duration());
		this.frameIndex = snapIndex(this.frameTimes, this.engine.time());
		this.refresh();
	}

	private seekKey(key: KeyName): boolean {
		const result = seekStripKey(this.frameTimes, this.frameIndex, key);
		this.frameIndex = result.index;
		this.strip?.select(result.index);
		if (result.commit !== undefined) {
			commitSeek(result.commit, time => this.engine.time(time), () => undefined, () => void this.engine.play());
			this.seekMode = false;
			this.controlsVisible = false;
			this.refresh();
		}
		else if (result.cancel) {
			cancelSeek(() => undefined, () => void this.engine.play());
			this.seekMode = false;
			this.controlsVisible = false;
			this.refresh();
		}
		return result.consumed;
	}

	private showVolume(): void {
		window.clearTimeout(this.volumeTimer);
		this.timeout(() => {
			const volume = (this.player as unknown as { volume?: { level?: number; muted?: boolean } }).volume;
			this.volumeShown = { volume: (volume?.level ?? 0) / 100, muted: Boolean(volume?.muted) };
			this.refresh();
			this.volumeTimer = this.timeout(() => {
				this.volumeShown = null;
				this.refresh();
			}, VOLUME_MS);
		}, 50);
	}

	private stepBackSettings(): void {
		if (!this.settings)
			return;
		const next = settingsStepBack(this.settings);
		if (next === 'close') {
			this.settings = null;
			this.emit('settings', { open: false });
		}
		else {
			this.settings = next;
			this.enteredAt = performance.now();
		}
		this.refresh();
	}

	private updateBar(): void {
		if (!this.bar || !this.controlsVisible)
			return;
		const chapters = (this.engine.chapters?.() ?? []).map((chapter, index, all) => ({ start: chapter.start, end: chapter.end ?? all[index + 1]?.start ?? this.engine.duration() }));
		this.bar.update({ playing: !this.engine.paused?.(), time: this.engine.time(), duration: this.engine.duration(), buffered: 0, chapters });
	}

	private choices(labels: string[] | undefined, current: number | null, pick: (index: number) => void, first?: Choice): Choice[] {
		const list = (labels ?? []).map((label, index) => ({ label, selected: current === index, onPick: () => pick(index) }));
		return first ? [first, ...list] : list;
	}

	private styleChoices(prop: StyleProp): Choice[] {
		const apply = (patch: Record<string, unknown>) => () => {
			this.engine.subtitleStyle?.(patch);
			this.refresh();
		};
		const current = this.engine.subtitleStyle?.() ?? {};
		if (prop === 'fontSize')
			return FONT_SIZE_CHOICES.map(size => ({ label: `${size}sp`, selected: current.fontSize === size, onPick: apply({ fontSize: size }) }));
		if (prop === 'background')
			return BACKGROUND_CHOICES.map(opacity => ({ label: opacity === 0 ? t('subtitle_style_background_transparent') : `${opacity * 100}%`, selected: current.backgroundOpacity === opacity, onPick: apply({ backgroundOpacity: opacity }) }));
		const names = prop === 'edgeStyle' ? ['none', 'depressed', 'drop_shadow', 'raised', 'uniform', 'text_shadow'] : prop === 'textColor' ? ['white', 'black', 'red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'orange', 'purple', 'gray'] : [];
		const field = prop === 'edgeStyle' ? 'edgeStyle' : 'fontColor';
		const group = prop === 'edgeStyle' ? 'edge' : 'color';
		return names.map(name => ({ label: t(`subtitle_style_${group}_${name}`), selected: current[field] === name, onPick: apply({ [field]: name }) }));
	}

	private buildDialog(): Panel | null {
		const engine = this.engine;
		const items = engine.queue();
		const current = engine.item();
		const audioIndex = engine.audioTrack?.()?.index ?? null;
		const subtitleIndex = engine.subtitle?.()?.index ?? null;
		const quality = engine.quality?.();
		const levelIndex = typeof quality === 'object' ? quality.index : -1;
		const audio = this.choices(engine.audioTracks?.().map(track => track.label), audioIndex, index => void engine.audioTrack?.(index));
		const subtitles = this.choices(engine.subtitles?.().map(track => track.label), subtitleIndex, index => void engine.subtitle?.(index), { label: t('dialog_subtitle_off'), selected: subtitleIndex === null, onPick: () => void engine.subtitle?.(null) });
		const auto = { label: t('player_quality_auto'), selected: levelIndex === -1, onPick: () => void engine.quality?.('auto') };
		const levels = this.choices(engine.qualityLevels?.().map(level => level.label), levelIndex, index => void engine.quality?.(index), auto);
		const toggleAutoSkip = (): void => {
			settingsStore.autoSkipChapters.value = !settingsStore.autoSkipChapters.value;
			this.refresh();
		};
		if (this.settings) {
			const nav = this.settings;
			const guard = (run: () => void) => () => {
				if (performance.now() - this.enteredAt > 300)
					run();
			};
			return settingsPanel({
				nav,
				levels: levels.map(choice => ({ ...choice, onPick: () => { choice.onPick(); this.settings = { pane: 'main', styleProp: null }; this.refresh(); } })),
				subtitles: subtitles.map(choice => ({ ...choice, onPick: () => { choice.onPick(); this.settings = { pane: 'main', styleProp: null }; this.refresh(); } })),
				audio: audio.map(choice => ({ ...choice, onPick: () => { choice.onPick(); this.settings = { pane: 'main', styleProp: null }; this.refresh(); } })),
				values: { quality: levelIndex === -1 ? t('player_quality_auto') : levels.find(l => l.selected)?.label ?? '', subtitle: subtitles.find(s => s.selected)?.label ?? t('dialog_subtitle_off'), audio: audio.find(a => a.selected)?.label ?? '' },
				autoSkip: settingsStore.autoSkipChapters.value,
				style: { font: String(engine.subtitleStyle?.()?.fontFamily ?? ''), size: Number(engine.subtitleStyle?.()?.fontSize ?? 24), edge: String(engine.subtitleStyle?.()?.edgeStyle ?? ''), color: String(engine.subtitleStyle?.()?.fontColor ?? ''), background: Number(engine.subtitleStyle?.()?.backgroundOpacity ?? 0) },
				styleChoices: prop => this.styleChoices(prop),
				open: (pane, prop) => { this.settings = { pane, styleProp: prop ?? null }; this.enteredAt = performance.now(); this.refresh(); },
				onBack: () => this.stepBackSettings(),
				onRestart: guard(() => { void engine.restart(); this.settings = null; this.refresh(); }),
				onToggleAutoSkip: toggleAutoSkip,
				onResetStyle: guard(() => { engine.subtitleStyle?.({}); this.refresh(); }),
			});
		}
		if (this.preScreenVisible) {
			return preScreen({
				item: current,
				playlistSize: items.length,
				episodeCount: items.filter(item => item.season != null && item.episode != null).length,
				onPlay: () => { this.remote = false; this.preScreenVisible = false; void engine.play(); this.refresh(); },
				onRestart: () => { this.remote = false; void engine.restart(); this.preScreenVisible = false; this.refresh(); },
				onLanguage: () => { this.preScreenVisible = false; this.languageOpen = true; this.refresh(); },
				onEpisodes: () => { this.preScreenVisible = false; this.episodeOpen = true; this.refresh(); },
			});
		}
		if (this.episodeOpen)
			return episodeDialog({ items, currentIndex: engine.index?.() ?? 0, onPick: (index) => { engine.item(items[index]?.id); this.episodeOpen = false; this.refresh(); } });
		if (this.languageOpen)
			return languageDialog({ quality: levels, audio, subtitles, autoSkip: settingsStore.autoSkipChapters.value, onToggleAutoSkip: toggleAutoSkip, onSearch: () => { this.searchOpen = true; this.refresh(); } });
		if (this.searchOpen)
			return messageDialog({ title: t('subtitle_search_title'), actions: [{ label: t('close'), run: () => { this.searchOpen = false; this.refresh(); } }] });
		if (this.error && mediaAbsentClaims(this.error) && !this.absenceAnswered && engine.paused?.() !== false)
			return messageDialog({ title: t('media_absent_title'), body: t('media_absent_body'), actions: [{ label: t('media_absent_skip'), run: () => { this.absenceAnswered = true; void engine.next?.(); this.refresh(); } }, { label: t('media_absent_exit'), run: () => { this.absenceAnswered = true; this.opts?.onExit?.(); } }] });
		if (this.error && !mediaAbsentClaims(this.error))
			return errorDialog(this.error, this.error.includes('transcode'), () => { this.error = null; void engine.restart(); this.refresh(); }, () => this.opts?.onExit?.());
		return null;
	}

	private refresh(): void {
		if (!this.root)
			return;
		const engine = this.engine;
		const items = engine.queue();
		const current = engine.item();
		const index = engine.index?.() ?? 0;
		const parts: Array<HTMLElement> = [];
		this.bar = null;
		this.strip = null;
		const dialog = this.buildDialog();
		this.panel = dialog;
		if (this.controlsVisible && !this.seekMode && !this.settings) {
			parts.push(topBar({ item: current, hasNext: index < items.length - 1, onSettings: () => { this.settings = { pane: 'main', styleProp: null }; this.controlsVisible = false; this.enteredAt = performance.now(); this.emit('settings', { open: true }); this.refresh(); }, onNext: () => void engine.next?.() }).root);
		}
		if (this.controlsVisible || this.seekMode) {
			this.bar = bottomBar(() => void (engine.paused?.() ? engine.play() : engine.pause()));
			parts.push(this.bar.root);
		}
		if (this.seekMode) {
			this.strip = seekStrip(this.frameTimes, this.frameIndex);
			parts.push(this.strip.root);
		}
		if (dialog)
			parts.push(dialog.root);
		if (this.volumeShown)
			parts.push(volumeIndicator(this.volumeShown.volume, this.volumeShown.muted));
		this.root.replaceChildren(...parts, el('span', 'tvui-sr', ''));
		this.updateBar();
		dialog?.focus();
		if (this.controlsVisible && !this.seekMode && !dialog) {
			this.bar?.focus();
			this.scheduleHide();
		}
	}
}

export type { UiItem };
