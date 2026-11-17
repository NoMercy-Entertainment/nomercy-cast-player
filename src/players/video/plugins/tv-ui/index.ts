import { LocalStorageBackend, Plugin } from '@nomercy-entertainment/nomercy-player-core';
import type { SidecarSubtitleInput } from '@nomercy-entertainment/nomercy-player-core';
import type { NMVideoPlayer, SubtitleStyle } from '@nomercy-entertainment/nomercy-video-player';
import { StorageBackedSubtitleStyleStore, VttChapterSource, VttSpriteThumbnailSource } from '@nomercy-entertainment/nomercy-video-player';
import i18next from '@/i18n/i18next';
import { authStore } from '@/stores/authStore';
import { settingsStore } from '@/stores/settingsStore';
import { decideSkipAction, segmentsForItem } from '@/players/video/skipSegments';
import { el, moveFocus, t } from './dom';
import type { Direction } from './dom';
import { fromEngineStyle, isPlaying, readVolume, toEngineStyle } from './engine';
import type { ViewStyle } from './engine';
import { mediaAbsentClaims } from './errors';
import { keyOf, routeRootKey, sharedKeyAction } from './keys';
import type { KeyName } from './keys';
import { backdropLayer, centerMessage, loadingLayer, showBackdrop, showLoading, skipPrompt } from './overlays';
import { bottomBar, episodeDialog, errorDialog, languageDialog, messageDialog, preScreen, seekStrip, settingsPanel, stickyTitle, subtitleSearchPanel, topBar, volumeIndicator } from './panels';
import type { BottomBarHandle, Choice, Panel, SearchView, SeekStripHandle, UiItem } from './panels';
import { downloadSubtitle, isRateLimited, searchSubtitles, searchTarget } from './subtitleSearch';
import type { SubtitleCandidate } from './subtitleSearch';
import { cancelSeek, canEnterSeekMode, chapterSeekTarget, commitSeek, frameTimesFor, seekStripKey, snapIndex } from './seek';
import { BACKGROUND_CHOICES, FONT_CHOICES, FONT_SIZE_CHOICES, fontName, SETTINGS_ANIM_MS, SETTINGS_EASING, videoShrink } from './settingsModel';
import { backAction, settingsStepBack } from './state';
import type { SettingsNav, StyleProp } from './state';
import { playingAudioIndex, qualityValue, subtitleLabel, trackLabel, wireOrder } from './title';
import type { LabeledTrack } from './title';
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
	settings: { open: boolean };
	exit: undefined;
}

interface SkipChapter {
	type?: string;
	endTime?: number;
}

type ChapterBusEvent = 'chapter-skip-available' | 'chapter-skip-clear';

// The chapter plugin emits these two; the library's event map does not list them.
interface ChapterBus {
	on: (event: ChapterBusEvent, fn: (chapter?: SkipChapter | null) => void) => void;
	off: (event: ChapterBusEvent, fn: (chapter?: SkipChapter | null) => void) => void;
}

function hasChapterBus(player: NMVideoPlayer): player is NMVideoPlayer & ChapterBus {
	return typeof player.on === 'function' && typeof player.off === 'function';
}

interface Engine {
	play: () => void;
	pause: () => void;
	restart: () => void;
	next?: () => void;
	item: (id?: number | string) => UiItem | undefined;
	queue: () => readonly UiItem[];
	index?: () => number;
	time: (seconds?: number) => number;
	duration: () => number;
	chapters?: () => Array<{ start: number; end?: number }>;
	audioTracks?: () => LabeledTrack[];
	audioTrack?: (index?: number) => { index: number } | null | undefined;
	subtitles?: () => LabeledTrack[];
	subtitle?: (index?: number | null) => { index: number } | null | undefined;
	qualityLevels?: () => Array<{ index: number; label: string }>;
	quality?: (value?: number | 'auto') => { index: number } | string | undefined;
	toggleMute?: () => void;
	playState?: () => string;
	volume?: () => number;
	volumeState?: () => string;
	buffered?: () => number;
	addSubtitleTrack?: (track: SidecarSubtitleInput) => void;
	subtitleStyle?: (patch?: Partial<SubtitleStyle>) => Partial<SubtitleStyle> | undefined;
}

async function authedFetch(url: string): Promise<Response | null> {
	const token = authStore.accessToken.value;
	const response = await fetch(url, token
		? { headers: { Authorization: `Bearer ${token}` } }
		: undefined).catch(() => null);

	return response?.ok
		? response
		: null;
}

const DEFAULT_STYLE = {
	fontSize: 24,
	fontColor: 'white',
	backgroundOpacity: 0,
	edgeStyle: 'none',
} as const satisfies Partial<ViewStyle>;
const AUTO_HIDE_MS = 5000;
const WATCHDOG_MS = 500;
const VOLUME_MS = 2000;
const NAMED_STYLE_CHOICES = {
	edgeStyle: {
		field: 'edgeStyle',
		group: 'edge',
		names: ['none', 'depressed', 'drop_shadow', 'raised', 'uniform', 'text_shadow'],
	},
	textColor: {
		field: 'fontColor',
		group: 'color',
		names: [
			'white',
			'black',
			'red',
			'green',
			'blue',
			'yellow',
			'magenta',
			'cyan',
			'orange',
			'purple',
			'gray',
		],
	},
} as const satisfies Record<'edgeStyle' | 'textColor', {
	field: 'edgeStyle' | 'fontColor';
	group: string;
	names: readonly string[];
}>;
const ARROWS: Partial<Record<KeyName, Direction>> = {
	left: 'left',
	right: 'right',
	up: 'up',
	down: 'down',
};

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
	private settingsFresh = false;
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
	private skipChapter: { type?: string; endTime?: number } | null = null;
	private nextOffered = false;
	private advancedItem: number | string | null = null;
	private message: string | null = null;
	private search: { status: SearchView['status']; results: SubtitleCandidate[] } | null = null;
	private thumbs = new VttSpriteThumbnailSource();
	private thumbsReady = false;
	private spriteBlob: string | null = null;
	private chapterSource = new VttChapterSource();
	private styleStore = new StorageBackedSubtitleStyleStore(new LocalStorageBackend());

	private get engine(): Engine {
		return this.player;
	}

	private playing(): boolean {
		return isPlaying(this.engine);
	}

	override use(): void {
		this.root = this.mount('tv-ui');
		this.root.classList.add('tvui-root');
		this.preScreenVisible = !this.opts?.skipPreScreen;
		this.listen(window, 'keydown', (event) => this.onKey(event), { capture: true });
		this.interval(() => this.reclaimFocus(), WATCHDOG_MS);

		this.thumbs.useFetchers({
			fetchText: async (url) => (await authedFetch(url))?.text() ?? null,
			fetchImageUrl: async (url) => {
				const response = await authedFetch(url);

				this.revokeSprite();

				this.spriteBlob = response
					? URL.createObjectURL(await response.blob())
					: null;

				return this.spriteBlob;
			},
		});

		this.lifecycle.addCleanup(() => this.revokeSprite());
		void this.styleStore.load().then((style) => style && this.engine.subtitleStyle?.(style));

		this.on('subtitleStyle', (style) =>
			void this.styleStore.save(style));

		this.on('play', () =>
			this.onPlayState(true));

		this.on('pause', () =>
			this.onPlayState(false));

		this.on('time', () => {
			this.updateNextEpisode();
			this.updateFirstFrame();
			this.updateBar();
		});

		if (hasChapterBus(this.player)) {
			this.listenChapters(this.player);
		}

		this.on('display-message', (data) => {
			this.message = data.text;
			this.refresh();
		});

		this.on('remove-message', () => {
			this.message = null;
			this.refresh();
		});

		this.on('item', () => {
			this.seekMode = false;
			this.error = null;
			this.absenceAnswered = false;
			this.skipChapter = null;
			this.nextOffered = false;
			this.advancedItem = null;
			this.loadThumbnails();
			this.loadChapters();
			this.refresh();
		});

		this.on('error', (error) => {
			this.error = typeof error === 'string'
				? error
				: (error as { message?: string } | undefined)?.message ?? 'error';

			this.absenceAnswered = false;
			this.refresh();
		});

		this.refresh();
	}

	private listenChapters(bus: ChapterBus): void {
		const available = (chapter?: SkipChapter | null): void => {
			this.skipChapter = chapter ?? null;
			this.refresh();
		};

		const cleared = (): void => {
			this.skipChapter = null;
			this.refresh();
		};

		bus.on('chapter-skip-available', available);
		bus.on('chapter-skip-clear', cleared);

		this.lifecycle.addCleanup(() => {
			bus.off('chapter-skip-available', available);
			bus.off('chapter-skip-clear', cleared);
		});
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
			case 'closeSearch':
				this.searchOpen = false;
				break;
			case 'settingsStepBack':
				this.stepBackSettings();

				return true;
			case 'closeDialogToPreScreen':
				this.episodeOpen = false;
				this.languageOpen = false;
				this.preScreenVisible = true;
				break;
			case 'cancelSeek':
				cancelSeek(() => undefined, () =>
					void this.engine.play());

				this.seekMode = false;
				this.controlsVisible = false;
				break;
			case 'hideControls':
				this.controlsVisible = false;
				break;
			case 'pauseToPreScreen':
				void this.engine.pause();
				this.preScreenVisible = true;
				break;
			case 'pauseAndExit':
				void this.engine.pause();
				this.leave();

				return false;
			case 'exit':
				this.leave();

				return true;
		}

		this.refresh();

		return true;
	}

	private leave(): void {
		this.opts?.onExit?.();
		this.emit('exit');
	}

	private dialogOpen(): boolean {
		return this.episodeOpen || this.languageOpen || this.searchOpen || this.settings !== null;
	}

	private blockingUi(): boolean {
		return this.preScreenVisible || this.dialogOpen();
	}

	private onPlayState(playing: boolean): void {
		if (playing && this.preScreenVisible) {
			this.preScreenVisible = false;
		}

		if (this.blockingUi() || playing) {
			this.controlsVisible = false;
		} else {
			this.controlsVisible = true;
		}

		this.clearHide();
		this.refresh();
	}

	private scheduleHide(): void {
		this.clearHide();

		this.hideTimer = this.timeout(() => {
			if (this.playing()) {
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

		const route = routeRootKey({
			preScreen: this.preScreenVisible,
			dialogOpen: this.dialogOpen(),
			seekMode: false,
			controlsVisible: this.controlsVisible,
			topBarFocused: Boolean(document.activeElement?.closest('.tvui-top-bar')),
			duration: this.engine.duration(),
		}, key);

		switch (route.action) {
			case 'enterSeek':
				this.enterSeek();

				return true;
			case 'showControls':
				this.controlsVisible = true;
				this.refresh();

				return true;
			case 'rescheduleHide':
				this.scheduleHide();
				break;
			case 'togglePlay':
				void (this.playing()
					? this.engine.pause()
					: this.engine.play());

				return true;
			case 'volume':
				this.showVolume();

				return false;
			case 'shared':
				return this.shared(key);
			case 'none':
				break;
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

		switch (action) {
			case 'toggleMute':
				this.engine.toggleMute?.();

				return true;
			case 'seekBack':
				this.seekByChapter(false);

				return true;
			case 'seekForward':
				this.seekByChapter(true);

				return true;
			default:
				return false;
		}
	}

	private seekByChapter(forward: boolean): void {
		const starts = this.chapterList().map((chapter) => chapter.start);
		const target = chapterSeekTarget(starts, this.engine.time(), forward, settingsStore.videoSeekStep.value);

		this.engine.time(target);
	}

	private enterSeek(): void {
		if (!canEnterSeekMode(this.engine.duration())) return;

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
		this.updateBar();

		if (result.commit !== undefined) {
			commitSeek(result.commit, (time) => this.engine.time(time), () => undefined, () =>
				void this.engine.play());

			this.seekMode = false;
			this.controlsVisible = false;
			this.refresh();
		} else if (result.cancel) {
			cancelSeek(() => undefined, () =>
				void this.engine.play());

			this.seekMode = false;
			this.controlsVisible = false;
			this.refresh();
		}

		return result.consumed;
	}

	private showVolume(): void {
		window.clearTimeout(this.volumeTimer);

		this.timeout(() => {
			const { level, muted } = readVolume(this.engine);

			this.volumeShown = { volume: level, muted };
			this.refresh();

			this.volumeTimer = this.timeout(() => {
				this.volumeShown = null;
				this.refresh();
			}, VOLUME_MS);
		}, 50);
	}

	private stepBackSettings(): void {
		if (!this.settings) return;

		const next = settingsStepBack(this.settings);

		if (next === 'close') {
			this.settings = null;
			this.emit('settings', { open: false });
		} else {
			this.settings = next;
			this.enteredAt = performance.now();
		}

		this.refresh();
	}

	private updateBar(): void {
		if (!this.bar || !this.controlsVisible) return;

		const duration = this.engine.duration();
		const chapters = this.chapterList().map((chapter, index, all) => ({
			start: chapter.start,
			end: chapter.end ?? all[index + 1]?.start ?? duration,
		}));

		const buffered = duration > 0
			? (this.engine.buffered?.() ?? 0) / duration * 100
			: 0;
		const override = this.seekMode
			? this.frameTimes[this.frameIndex]
			: null;

		this.bar.update({
			playing: this.playing(),
			time: this.engine.time(),
			duration,
			buffered,
			override,
			chapters,
		});
	}

	// TVOverlayPlugin.ts:186-214: offer the next episode inside the credits, advance at the content end.
	private updateNextEpisode(): void {
		const item = this.engine.item();
		const items = this.engine.queue();
		const index = this.engine.index?.() ?? 0;
		const hasNext = Boolean(item && index < items.length - 1 && this.engine.next);
		const action = decideSkipAction(this.engine.time(), segmentsForItem(item), hasNext);

		if (action === 'advance' && item && this.advancedItem !== item.id) {
			this.advancedItem = item.id ?? null;
			this.nextOffered = false;
			void this.engine.next?.();
			this.refresh();
		} else if ((action === 'next-button') !== this.nextOffered && action !== 'advance') {
			this.nextOffered = action === 'next-button';
			this.refresh();
		}
	}

	private lastFirstFrame = '';

	// The backdrop and loading overlay follow the clock; redraw only when one flips.
	private updateFirstFrame(): void {
		const key = `${this.firstFrame().backdrop}${this.firstFrame().loading}`;

		if (key !== this.lastFirstFrame) {
			this.lastFirstFrame = key;
			this.refresh();
		}
	}

	private firstFrame() {
		const state = {
			preScreen: this.preScreenVisible,
			duration: this.engine.duration(),
			time: this.engine.time(),
		};

		const loading = showLoading({ ...state, playing: this.playing() });

		return { backdrop: showBackdrop(state), loading } as const satisfies {
			backdrop: boolean;
			loading: boolean;
		};
	}

	// TvUiPlugin.kt:447-485: BACK and the D-pad need focus inside the player.
	private reclaimFocus(): void {
		if (!this.panel && !this.controlsVisible) return;

		if (this.root.contains(document.activeElement) || this.settingsEntering()) return;

		(this.panel ?? this.bar)?.focus();
	}

	private settingsEntering(): boolean {
		return this.settings !== null && performance.now() - this.enteredAt < 300;
	}

	// Sprite frames come from the library's thumbnail source; the cue file is the item's 'thumbnails' track.
	private chapterList(): Array<{ start: number; end?: number }> {
		const own = this.chapterSource.all();

		return own.length > 0
			? own
			: (this.engine.chapters?.() ?? []);
	}

	private revokeSprite(): void {
		if (this.spriteBlob) {
			URL.revokeObjectURL(this.spriteBlob);
		}

		this.spriteBlob = null;
	}

	private loadChapters(): void {
		const item = this.engine.item();

		if (item?.id === undefined) return;

		void this.chapterSource.load({ ...item, id: item.id });
	}

	private loadThumbnails(): void {
		this.thumbsReady = false;
		const item = this.engine.item();
		const file = item?.tracks?.find((track) => track.kind === 'thumbnails')?.file;
		const base = authStore.serverUrl.value;

		if (item?.id === undefined || !file || !base) return;

		const source = { id: item.id, previewSpriteUrl: new URL(file, base).href };

		void this.thumbs.load(source).then((ready) => {
			this.thumbsReady = ready;
		});
	}

	private thumbnail = (time: number): {
		url: string;
		x: number;
		y: number;
		w: number;
		h: number;
	} | null => {
		const frame = this.thumbsReady
			? this.thumbs.lookup(time)
			: null;

		return frame
			? {
					url: frame.spriteUrl,
					x: frame.x,
					y: frame.y,
					w: frame.w,
					h: frame.h,
				}
			: null;
	};

	private runSearch(): void {
		const target = searchTarget(this.engine.item());

		this.search = { status: 'loading', results: [] };

		if (!target) {
			this.search.status = 'error';

			return;
		}

		void searchSubtitles(target, i18next.language || 'en').then((results) => {
			const status = results.length > 0
				? 'results'
				: 'empty';

			this.search = { status, results };
		}).catch((error: Error) => {
			const status = isRateLimited(error)
				? 'rateLimited'
				: 'error';

			this.search = { status, results: [] };
		}).finally(() => this.refresh());
	}

	private pickSubtitle(candidate: SubtitleCandidate): void {
		const target = searchTarget(this.engine.item());

		if (!target || !this.search) return;

		const results = this.search.results;

		this.search = { status: 'downloading', results };
		this.refresh();

		void downloadSubtitle(target, candidate).then((track) => {
			const base = authStore.serverUrl.value ?? window.location.href;

			this.engine.addSubtitleTrack?.({
				url: new URL(track.file, base).href,
				label: candidate.languageName || track.label,
				language: track.language,
			});

			this.search = { status: 'downloaded', results };
		}).catch((error: Error) => {
			const status = isRateLimited(error)
				? 'rateLimited'
				: 'downloadError';

			this.search = { status, results };
		}).finally(() => this.refresh());
	}

	private choices(
		labels: string[] | undefined,
		current: number | null,
		pick: (index: number) => void,
		first?: Choice,
	): Choice[] {
		const list = (labels ?? []).map((label, index) => ({
			label,
			selected: current === index,
			onPick: () => pick(index),
		}));

		return first
			? [first, ...list]
			: list;
	}

	private styleChoices(prop: StyleProp): Choice[] {
		const apply = (patch: Partial<ViewStyle>) => () => {
			this.engine.subtitleStyle?.(toEngineStyle(patch));
			this.refresh();
		};

		const current = fromEngineStyle(this.engine.subtitleStyle?.());

		if (prop === 'fontSize') {
			return FONT_SIZE_CHOICES.map((size) => ({
				label: `${size}sp`,
				selected: current.fontSize === size,
				onPick: apply({ fontSize: size }),
			}));
		}

		if (prop === 'background') {
			return BACKGROUND_CHOICES.map((opacity) => ({
				label: opacity === 0
					? t('subtitle_style_background_transparent')
					: `${opacity * 100}%`,
				selected: current.backgroundOpacity === opacity,
				onPick: apply({ backgroundOpacity: opacity }),
			}));
		}

		if (prop === 'fontFamily') {
			return FONT_CHOICES.map((font) => ({
				label: font.name,
				selected: fontName(current.fontFamily).toLowerCase() === font.name.toLowerCase(),
				onPick: apply({ fontFamily: font.stack }),
			}));
		}

		if (prop !== 'edgeStyle' && prop !== 'textColor')
			return [];

		const named = NAMED_STYLE_CHOICES[prop];

		return named.names.map((name) => ({
			label: t(`subtitle_style_${named.group}_${name}`),
			selected: current[named.field] === name,
			onPick: apply({ [named.field]: name }),
		}));
	}

	// The first level is Auto; KMP's own level list holds only the real ones.
	private trackChoices() {
		const engine = this.engine;
		const audioIndex = playingAudioIndex(
			engine.audioTrack?.()?.index ?? null,
			engine.audioTracks?.() ?? [],
		);
		const subtitleIndex = engine.subtitle?.()?.index ?? null;
		const quality = engine.quality?.();
		const levelIndex = typeof quality === 'object'
			? quality.index
			: -1;

		const locale = i18next.language || 'en';
		const audioLabels = engine.audioTracks?.().map((track) => trackLabel(track, locale));
		const subtitleTracks = engine.subtitles?.() ?? [];
		const subtitleLabels = subtitleTracks.map((track) => subtitleLabel(track, locale));
		const wire = engine.item()?.tracks?.filter((track) => track.kind === 'subtitles') ?? [];
		const subtitleOrder = wireOrder(subtitleTracks, wire);
		const pickSubtitle = (index: number): void => void engine.subtitle?.(index);
		const subtitleRows = this.choices(subtitleLabels, subtitleIndex, pickSubtitle);
		const levelLabels = engine.qualityLevels?.().map((level) => level.label);
		const off = {
			label: t('dialog_subtitle_off'),
			selected: subtitleIndex === null,
			onPick: () => void engine.subtitle?.(null),
		};

		const auto = {
			label: t('player_quality_auto'),
			selected: levelIndex === -1,
			onPick: () => void engine.quality?.('auto'),
		};

		return {
			audio: this.choices(audioLabels, audioIndex, (index) =>
				void engine.audioTrack?.(index)),
			subtitles: [off, ...subtitleOrder.flatMap((index) => subtitleRows[index] ?? [])],
			levels: this.choices(levelLabels, levelIndex, (index) => void engine.quality?.(index), auto),
		} as const satisfies {
			audio: Choice[];
			subtitles: Choice[];
			levels: Choice[];
		};
	}

	private buildDialog(): Panel | null {
		const engine = this.engine;
		const items = engine.queue();
		const current = engine.item();
		const { audio, subtitles, levels } = this.trackChoices();
		const toMain = (choice: Choice) => ({
			...choice,
			onPick: this.act(() => {
				choice.onPick();
				this.settings = { pane: 'main', styleProp: null };
			}),
		}) as const satisfies Choice;

		const toggleAutoSkip = (): void => {
			settingsStore.autoSkipChapters.value = !settingsStore.autoSkipChapters.value;
			this.refresh();
		};

		if (this.settings) {
			const nav = this.settings;
			const view = fromEngineStyle(engine.subtitleStyle?.());

			const guard = (run: () => void) => () => {
				if (performance.now() - this.enteredAt > 300) {
					run();
				}
			};

			return settingsPanel({
				nav,
				levels: levels.map(toMain),
				subtitles: subtitles.map(toMain),
				audio: audio.map(toMain),
				values: {
					quality: qualityValue(levels, t('player_quality_auto')),
					subtitle: subtitles.find((s) => s.selected)?.label ?? t('dialog_subtitle_off'),
					audio: audio.find((a) => a.selected)?.label ?? '',
				},
				autoSkip: settingsStore.autoSkipChapters.value,
				style: {
					font: fontName(view.fontFamily),
					size: view.fontSize,
					edge: t(`subtitle_style_edge_${view.edgeStyle}`),
					color: t(`subtitle_style_color_${view.fontColor}`),
					background: view.backgroundOpacity,
				},
				styleChoices: (prop) => this.styleChoices(prop),
				open: (pane, prop) => this.act(() => {
					this.settings = { pane, styleProp: prop ?? null };
					this.enteredAt = performance.now();
				})(),
				onBack: () => this.stepBackSettings(),
				onRestart: guard(this.act(() => {
					void engine.restart();
					this.settings = null;
				})),
				onToggleAutoSkip: toggleAutoSkip,
				onResetStyle: guard(this.act(() => {
					engine.subtitleStyle?.(toEngineStyle(DEFAULT_STYLE));
					void this.styleStore.clear();
				})),
			});
		}

		if (this.preScreenVisible) {
			return preScreen({
				item: current,
				playlistSize: items.length,
				episodeCount: items.filter((item) => item.season != null && item.episode != null).length,
				onPlay: this.act(() => {
					this.remote = false;
					this.preScreenVisible = false;
					void engine.play();
				}),
				onRestart: this.act(() => {
					this.remote = false;
					void engine.restart();
					this.preScreenVisible = false;
				}),
				onLanguage: this.act(() => {
					this.preScreenVisible = false;
					this.languageOpen = true;
				}),
				onEpisodes: this.act(() => {
					this.preScreenVisible = false;
					this.episodeOpen = true;
				}),
			});
		}

		if (this.episodeOpen) {
			return episodeDialog({
				items,
				currentIndex: engine.index?.() ?? 0,
				onPick: (index) => this.act(() => {
					engine.item(items[index]?.id);
					this.episodeOpen = false;
				})(),
			});
		}

		if (this.searchOpen && this.search) {
			return subtitleSearchPanel({
				status: this.search.status,
				results: this.search.results,
				onPick: (candidate) => this.pickSubtitle(candidate),
			});
		}

		if (this.languageOpen) {
			return languageDialog({
				quality: levels,
				audio,
				subtitles,
				autoSkip: settingsStore.autoSkipChapters.value,
				onToggleAutoSkip: toggleAutoSkip,
				onSearch: this.act(() => {
					this.searchOpen = true;
					this.runSearch();
				}),
			});
		}

		if (this.error && mediaAbsentClaims(this.error) && !this.absenceAnswered && !this.playing()) {
			const skip = this.act(() => {
				this.absenceAnswered = true;
				void engine.next?.();
			});

			const exit = (): void => {
				this.absenceAnswered = true;
				this.opts?.onExit?.();
			};

			return messageDialog({
				title: t('media_absent_title'),
				body: t('media_absent_body'),
				actions: [{ label: t('media_absent_skip'), run: skip }, { label: t('media_absent_exit'), run: exit }],
			});
		}

		if (this.error && !mediaAbsentClaims(this.error)) {
			const retry = this.act(() => {
				this.error = null;
				void engine.restart();
			});

			return errorDialog(this.error, this.error.includes('transcode'), retry, () =>
				this.opts?.onExit?.());
		}

		return null;
	}

	private act(change: () => void): () => void {
		return () => {
			change();
			this.refresh();
		};
	}

	// SkipOverlay.kt: the chapter pill and the next-episode pill sit apart from the bars and unmount behind any panel.
	private skipPills(): HTMLElement[] {
		const pills: HTMLElement[] = [];
		const chapter = this.skipChapter;

		if (chapter) {
			const label = t(chapter.type === 'credits'
				? 'skip_credits'
				: 'skip_intro');

			pills.push(skipPrompt(label, () => {
				this.skipChapter = null;

				if (typeof chapter.endTime === 'number') {
					this.engine.time(chapter.endTime);
				}

				this.refresh();
			}));
		}

		if (this.nextOffered) {
			const label = t('skip_next_episode');

			pills.push(skipPrompt(label, () => {
				this.nextOffered = false;
				void this.engine.next?.();
				this.refresh();
			}));
		}

		return pills;
	}

	// The whole picture moves aside for the sidebar: WatchScreen.kt:508-560 and TvUiPlugin.videoTransform.
	private shrinkPicture(open: boolean): void {
		const container = this.root.parentElement;
		const layers = [
			container?.querySelector<HTMLElement>('video'),
			container?.querySelector<HTMLElement>('.subtitle-safezone'),
			...(container?.querySelectorAll<HTMLElement>('.nomercy-libass-box, .ass-plain-text') ?? []),
			...this.root.querySelectorAll<HTMLElement>('.tvui-backdrop, .tvui-loading'),
		];

		const titleBottom = open
			? this.titleBottom()
			: 0;

		const width = this.root.clientWidth || window.innerWidth;
		const { scale, translateX, translateY, radius } = videoShrink(width, titleBottom);

		// WatchScreen.kt:587: the picture keeps its black; the app background shows around it.
		if (container) {
			container.style.background = open
				? 'var(--cast-bg-base)'
				: '';
		}

		const video = layers[0];

		if (video) {
			video.style.background = open
				? 'black'
				: '';
		}

		for (const layer of layers) {
			if (!layer) continue;

			layer.style.transition = `transform ${SETTINGS_ANIM_MS}ms ${SETTINGS_EASING}, border-radius ${SETTINGS_ANIM_MS}ms ${SETTINGS_EASING}`;

			layer.style.borderRadius = open
				? `${radius}px`
				: '0';

			layer.style.transform = open
				? `translate(${translateX}px, ${translateY}px) scale(${scale})`
				: '';
		}
	}

	// Bottom of the title text inside its 32px padding, relative to the player: WatchScreen.kt:654-656.
	private titleBottom(): number {
		const titles = this.root.querySelector('.tvui-sticky-title .tvui-titles');

		return titles
			? titles.getBoundingClientRect().bottom - this.root.getBoundingClientRect().top
			: 0;
	}

	private refresh(): void {
		if (!this.root) return;

		const engine = this.engine;
		const items = engine.queue();
		const current = engine.item();
		const index = engine.index?.() ?? 0;
		const parts: Array<HTMLElement> = [];

		this.bar = null;
		this.strip = null;
		const dialog = this.buildDialog();

		this.panel = dialog;
		const frame = this.firstFrame();

		this.lastFirstFrame = `${frame.backdrop}${frame.loading}`;
		const art = current?.backdrop ?? current?.image ?? null;

		if (frame.backdrop && art) {
			parts.push(backdropLayer(art));
		}

		if (frame.loading) {
			parts.push(loadingLayer(current?.image ?? null));
		}

		if (this.message) {
			parts.push(centerMessage(this.message));
		}

		if (this.controlsVisible && !this.seekMode && !this.settings) {
			const openSettings = this.act(() => {
				this.settings = { pane: 'main', styleProp: null };
				this.controlsVisible = false;
				this.settingsFresh = true;
				this.enteredAt = performance.now();
				this.emit('settings', { open: true });
			});

			parts.push(topBar({
				item: current,
				hasNext: index < items.length - 1,
				onSettings: openSettings,
				onNext: () => void engine.next?.(),
			}).root);
		}

		if (this.controlsVisible || this.seekMode) {
			this.bar = bottomBar(() => void (this.playing()
				? engine.pause()
				: engine.play()));

			parts.push(this.bar.root);
		}

		if (this.seekMode) {
			this.strip = seekStrip(this.frameTimes, this.frameIndex, this.thumbnail);
			parts.push(this.strip.root);
		}

		if (!this.blockingUi() && !this.seekMode) {
			parts.push(...this.skipPills());
		}

		if (dialog) {
			parts.push(dialog.root);
		}

		if (this.settings) {
			parts.push(stickyTitle(current));
		}

		if (this.volumeShown) {
			parts.push(volumeIndicator(this.volumeShown.volume, this.volumeShown.muted));
		}

		this.root.replaceChildren(...parts, el('span', 'tvui-sr', ''));

		if (this.settingsFresh) {
			this.settingsFresh = false;
			this.root.querySelector('.tvui-settings')?.classList.add('tvui-settings-enter');
			this.root.querySelector('.tvui-sticky-title')?.classList.add('tvui-sticky-title-enter');
		}

		this.shrinkPicture(this.settings !== null);
		this.updateBar();
		dialog?.focus();

		if (this.controlsVisible && !this.seekMode && !dialog) {
			this.bar?.focus();
			this.scheduleHide();
		}
	}
}

export type { UiItem };
