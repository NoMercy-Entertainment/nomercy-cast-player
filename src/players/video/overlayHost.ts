// The 2.x player has no overlay element, only the container it mounts into.
// Panels need a host of their own inside it, above the video and captions.
export function mountOverlayHost(container: HTMLElement): HTMLElement {
	const host = document.createElement('div');
	host.className = 'tv-overlay-host';
	container.append(host);
	return host;
}
