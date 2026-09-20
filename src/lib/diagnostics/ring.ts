import type {
	DiagnosticsCategoryValue,
	DiagnosticsCodeValue,
	DiagnosticsEntry,
} from './events';
import { DIAGNOSTICS_CATEGORIES, DIAGNOSTICS_CODES } from './events';

export const DEFAULT_DIAGNOSTICS_CAPACITY = 2000;

/**
 * A fixed ring of the most recent events, so a fault on a television nobody is
 * sitting in front of can still be read hours later. Recording is six typed
 * array stores and a counter increment against arrays allocated once.
 */
export class DiagnosticsRing {
	private readonly atMs: Float64Array;
	private readonly categories: Int32Array;
	private readonly codes: Int32Array;
	private readonly fieldA: Int32Array;
	private readonly fieldB: Int32Array;
	private readonly fieldC: Int32Array;

	// Total ever recorded, not the index. It says whether the ring has wrapped
	// and where the oldest surviving event is.
	private written = 0;

	constructor(
		private readonly capacity: number = DEFAULT_DIAGNOSTICS_CAPACITY,
		private readonly clock: () => number = () => performance.now(),
	) {
		this.atMs = new Float64Array(capacity);
		this.categories = new Int32Array(capacity);
		this.codes = new Int32Array(capacity);
		this.fieldA = new Int32Array(capacity);
		this.fieldB = new Int32Array(capacity);
		this.fieldC = new Int32Array(capacity);
	}

	record(
		category: DiagnosticsCategoryValue,
		code: DiagnosticsCodeValue,
		a = 0,
		b = 0,
		c = 0,
	): void {
		const slot = this.written % this.capacity;

		this.atMs[slot] = this.clock();
		this.categories[slot] = category;
		this.codes[slot] = code;
		this.fieldA[slot] = a;
		this.fieldB[slot] = b;
		this.fieldC[slot] = c;
		this.written += 1;
	}

	/** Oldest surviving event first. */
	snapshot(): DiagnosticsEntry[] {
		const held = Math.min(this.written, this.capacity);
		const oldest = this.written <= this.capacity ? 0 : this.written - this.capacity;
		const entries: DiagnosticsEntry[] = [];

		for (let offset = 0; offset < held; offset += 1) {
			const slot = (oldest + offset) % this.capacity;
			entries.push({
				atMs: this.atMs[slot],
				category: DIAGNOSTICS_CATEGORIES[this.categories[slot]],
				code: DIAGNOSTICS_CODES[this.codes[slot]],
				a: this.fieldA[slot],
				b: this.fieldB[slot],
				c: this.fieldC[slot],
			});
		}

		return entries;
	}

	/** How many events happened, including the ones the ring has since dropped. */
	recorded(): number {
		return this.written;
	}

	clear(): void {
		this.written = 0;
	}
}
