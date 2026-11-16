import { h, render } from 'vue';
import MoooomIcon from '@/components/icons/MoooomIcon.vue';
import i18next from '@/i18n/i18next';

export type IconName = 'play' | 'pause' | 'settings' | 'next' | 'check' | 'chevronLeft' | 'chevronRight' | 'globe' | 'playlist1' | 'volumeMuted' | 'volumeOne' | 'volumeTwo' | 'volumeThree' | 'rewind' | 'translate';

export function t(key: string, vars?: Record<string, unknown>): string {
	return i18next.t(`tvui.${key}`, vars);
}

export function el(tag: string, className: string, ...children: Array<Node | string | null | false>): HTMLElement {
	const node = document.createElement(tag);
	node.className = className;
	for (const child of children) {
		if (child)
			node.append(child);
	}
	return node;
}

// Icons come from the one Moooom set through MoooomIcon, rendered into a plain element.
export function icon(name: IconName): HTMLElement {
	const holder = document.createElement('span');
	holder.className = 'tvui-icon';
	render(h(MoooomIcon, { icon: name }), holder);
	return holder;
}

export function focusable(node: HTMLElement, onClick: () => void): HTMLElement {
	node.tabIndex = 0;
	node.dataset.focusable = 'true';
	node.addEventListener('click', onClick);
	return node;
}

export function formatTime(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const rest = String(total % 60).padStart(2, '0');
	return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${String(minutes).padStart(2, '0')}:${rest}`;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

// Directional focus like Compose's moveFocus: the nearest focusable in that direction.
export function moveFocus(root: HTMLElement, direction: Direction): boolean {
	const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-focusable]')).filter(node => !node.hasAttribute('aria-disabled'));
	const current = document.activeElement as HTMLElement | null;
	const from = current && nodes.includes(current) ? current : null;
	if (!from) {
		nodes[0]?.focus();
		return nodes.length > 0;
	}
	const a = from.getBoundingClientRect();
	const ax = a.left + a.width / 2;
	const ay = a.top + a.height / 2;
	let best: HTMLElement | null = null;
	let bestScore = Infinity;
	for (const node of nodes) {
		if (node === from)
			continue;
		const b = node.getBoundingClientRect();
		const dx = b.left + b.width / 2 - ax;
		const dy = b.top + b.height / 2 - ay;
		const along = direction === 'up' ? -dy : direction === 'down' ? dy : direction === 'left' ? -dx : dx;
		if (along <= 0)
			continue;
		const across = direction === 'up' || direction === 'down' ? Math.abs(dx) : Math.abs(dy);
		const score = along + across * 2;
		if (score < bestScore) {
			bestScore = score;
			best = node;
		}
	}
	best?.focus();
	best?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	return best !== null;
}
