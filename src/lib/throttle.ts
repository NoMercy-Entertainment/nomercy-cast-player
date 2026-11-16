// Leading call goes through at once; one trailing call per window carries the latest arguments.
export function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
	let last = 0;
	let pending: ReturnType<typeof setTimeout> | null = null;

	return ((...args: never[]) => {
		const now = Date.now();

		if (now - last >= ms) {
			last = now;
			fn(...args);
		} else if (pending === null) {
			pending = setTimeout(
				() => {
					last = Date.now();
					pending = null;
					fn(...args);
				},
				ms - (now - last),
			);
		}
	}) as T;
}
