/**
 * Server-component descriptor types per spec §11.1. Ported verbatim from
 * the android Component.kt models — any drift here breaks parity with
 * web/android server-driven UI.
 */

export type ComponentType
	= | 'NMGrid'
		| 'NMList'
		| 'NMContainer'
		| 'NMCarousel'
		| 'NMCard'
		| 'NMHomeCard'
		| 'NMMusicCard'
		| 'NMMusicHomeCard'
		| 'NMTopResultCard'
		| 'NMGenreCard'
		| 'NMTrackRow'
		| 'NMHero'
		| 'NMHeroCard'
		| 'PluginSlot';

export interface Update {
	/** "pageLoad" triggers refetch on revisit; other values are forward-compat. */
	when?: 'pageLoad' | 'mount' | 'visible' | 'manual' | string;
	link?: string;
	body?: Record<string, string>;
}

export interface ContextMenuItem {
	id?: string;
	title?: string;
	action?: string;
	icon?: string;
	destructive?: boolean;
}

export interface ContainerWrapper {
	id: string;
	title?: string;
	items: Component[];
	next_id?: string;
	previous_id?: string;
	more_link?: string;
	more_link_text?: string;
	context_menu_items?: ContextMenuItem[];
	url?: string;
	properties?: Record<string, unknown>;
}

export type NMGridWrapper = ContainerWrapper;
export type NMListWrapper = ContainerWrapper;
export type NMContainerWrapper = ContainerWrapper;
export type NMCarouselWrapper = ContainerWrapper;

export interface NMCardWrapper {
	id: string;
	title?: string;
	subtitle?: string;
	description?: string;
	image?: string;
	logo?: string;
	link?: string;
	type?: string;
	year?: number | string;
	rating?: { rating: number | string; image?: string };
	progress?: { time?: number; total?: number };
	context_menu_items?: ContextMenuItem[];
}

export interface NMHomeCardWrapper extends NMCardWrapper {
	show?: string;
	episode?: number;
	season?: number;
	duration?: string;
}

export interface NMMusicCardWrapper {
	id: string;
	name?: string;
	artist?: string;
	album?: string;
	cover?: string;
	link?: string;
	duration?: string;
	favorite?: boolean;
	context_menu_items?: ContextMenuItem[];
}

export interface NMMusicHomeCardWrapper extends NMMusicCardWrapper {
	type?: string;
	description?: string;
}

export interface NMTrackRowWrapper {
	id: string;
	position?: number;
	name: string;
	artist?: string;
	album?: string;
	duration?: string;
	link?: string;
	cover?: string;
	favorite?: boolean;
	context_menu_items?: ContextMenuItem[];
}

export interface NMTopResultCardWrapper {
	id: string;
	title: string;
	subtitle?: string;
	image?: string;
	type?: string;
	link?: string;
}

/**
 * A place on this screen where whatever a plugin put there draws.
 *
 * Carried in the same payload as everything else, so the server decides a
 * plugin row belongs between two of its own rails rather than every client
 * hard-coding where plugins are allowed to appear.
 */
export interface PluginSlotWrapper {
	id: string;
	/** One of PluginKind. */
	kind: string;
	/** One of PluginSlot. */
	slot: string;
}

export type ComponentData
	= | NMGridWrapper
		| NMListWrapper
		| NMContainerWrapper
		| NMCarouselWrapper
		| NMCardWrapper
		| NMHomeCardWrapper
		| NMMusicCardWrapper
		| NMMusicHomeCardWrapper
		| NMTopResultCardWrapper
		| NMTrackRowWrapper
		| PluginSlotWrapper;

export interface Component {
	id: string;
	component: ComponentType;
	props: ComponentData;
	update?: Update;
}

/**
 * Container types whose props carry an `items` array. Used by the resolver
 * + pageLoad walker to recurse.
 */
export const CONTAINER_TYPES: ReadonlySet<ComponentType> = new Set([
	'NMGrid',
	'NMList',
	'NMContainer',
	'NMCarousel',
]);
